import { prisma } from "../../lib/prisma"
import { mediaUrl } from "../../lib/media-url"
import { badRequest, conflict, notFound } from "../../lib/http-error"
import { analyzeSeo, normalize, topIssue, type SeoCheck, type SeoContext, type SeoInput } from "./analyzer"
import { getSettings } from "./settings.service"

type ContextPost = { id: number; title: string; slug: string; focusKeyword: string; metaDescription: string; excerpt: string; status: string }

const toOthers = (posts: ContextPost[], excludeId?: number) =>
  posts
    .filter((p) => p.id !== excludeId)
    .map((p) => ({ id: p.id, title: p.title, slug: p.slug, focusKeyword: p.focusKeyword, metaDescription: p.metaDescription || p.excerpt }))

async function loadContextData() {
  const [settings, posts] = await Promise.all([
    getSettings(),
    prisma.post.findMany({
      where: { status: { not: "trash" } },
      select: { id: true, title: true, slug: true, focusKeyword: true, metaDescription: true, excerpt: true, status: true },
    }),
  ])
  const publishedSlugs = new Set(posts.filter((p) => p.status === "published").map((p) => p.slug))
  return { settings, posts, publishedSlugs }
}

export async function buildContext(excludeId?: number): Promise<SeoContext> {
  const { settings, posts, publishedSlugs } = await loadContextData()
  return { siteUrl: settings.siteUrl, titleTemplate: settings.titleTemplate, others: toOthers(posts, excludeId), publishedSlugs }
}

/** Análise ao vivo de um rascunho (editor), sem salvar nada. */
export async function analyzeDraft(input: SeoInput & { coverId?: number | null }, postId?: number) {
  let coverAlt = input.coverAlt
  if (input.coverId) {
    const cover = await prisma.media.findUnique({ where: { id: input.coverId }, select: { alt: true } })
    coverAlt = cover ? cover.alt : null
  } else if (input.coverId === null) coverAlt = null
  return analyzeSeo({ ...input, coverAlt }, await buildContext(postId))
}

const postSeoSelect = {
  id: true, title: true, slug: true, excerpt: true, content: true, focusKeyword: true, metaTitle: true,
  metaDescription: true, canonicalUrl: true, index: true, cover: { select: { alt: true } },
} as const

type PostForSeo = { title: string; slug: string; excerpt: string; content: string; focusKeyword: string; metaTitle: string; metaDescription: string; canonicalUrl: string; index: boolean; cover: { alt: string } | null }

const inputFromPost = (p: PostForSeo): SeoInput => ({ ...p, coverAlt: p.cover ? p.cover.alt : null })

/** Recalcula e grava a nota de SEO de um post. */
export async function refreshPostSeo(postId: number) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: postSeoSelect })
  if (!post) return null
  const report = analyzeSeo(inputFromPost(post), await buildContext(postId))
  await prisma.post.update({ where: { id: postId }, data: { seoScore: report.score, seoReport: JSON.stringify(report.checks) } })
  return report
}

/** Recalcula todos os posts (ex.: depois de mudar o modelo de título ou a URL do site). */
export async function recalculateAll() {
  const { settings, posts, publishedSlugs } = await loadContextData()
  const full = await prisma.post.findMany({ where: { status: { not: "trash" } }, select: postSeoSelect })
  for (const p of full) {
    const report = analyzeSeo(inputFromPost(p), { siteUrl: settings.siteUrl, titleTemplate: settings.titleTemplate, others: toOthers(posts, p.id), publishedSlugs })
    await prisma.post.update({ where: { id: p.id }, data: { seoScore: report.score, seoReport: JSON.stringify(report.checks) } })
  }
  return { updated: full.length }
}

const parseChecks = (raw: string): SeoCheck[] => {
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

type Health = { id: string; level: "good" | "warning" | "error"; label: string; description: string; href?: string }

/** Painel de SEO: KPIs, posts a corrigir, saúde técnica e mapa de palavras-chave. */
export async function overview() {
  const settings = await getSettings()
  const posts = await prisma.post.findMany({
    where: { status: { not: "trash" } },
    select: {
      id: true, title: true, slug: true, status: true, index: true, seoScore: true, seoReport: true, focusKeyword: true,
      metaDescription: true, excerpt: true, cover: { select: { externalUrl: true, filename: true } },
    },
    orderBy: { seoScore: "asc" },
  })
  const published = posts.filter((p) => p.status === "published")
  const indexable = published.filter((p) => p.index)
  const imagesNoAlt = await prisma.media.count({ where: { type: "image", alt: "" } })
  const avg = posts.length ? Math.round(posts.reduce((a, p) => a + p.seoScore, 0) / posts.length) : 0

  const dupes = <T>(items: T[], key: (t: T) => string) => {
    const groups = new Map<string, T[]>()
    for (const it of items) {
      const k = normalize(key(it))
      if (k) groups.set(k, [...(groups.get(k) ?? []), it])
    }
    return [...groups.values()].filter((g) => g.length > 1)
  }
  const dupTitles = dupes(published, (p) => p.title)
  const dupDescs = dupes(published, (p) => p.metaDescription || p.excerpt)
  const noDesc = published.filter((p) => !(p.metaDescription || p.excerpt).trim())
  const noKeyword = posts.filter((p) => !p.focusKeyword.trim())
  const broken = posts.filter((p) => parseChecks(p.seoReport).some((c) => c.id === "broken-links"))

  const robots = settings.robots
  const blocksAll = /user-agent:\s*\*[\s\S]*?^disallow:\s*\/\s*$/im.test(robots)
  const hasSitemap = /^sitemap:/im.test(robots)

  const health: Health[] = [
    { id: "sitemap", level: "good", label: "sitemap.xml", description: `${indexable.length + 1} URLs (home + posts publicados indexáveis)`, href: "/sitemap.xml" },
    {
      id: "robots",
      level: blocksAll ? "error" : hasSitemap ? "good" : "warning",
      label: "robots.txt",
      description: blocksAll ? "Bloqueia todo o site para buscadores!" : hasSitemap ? "Rastreamento permitido e sitemap declarado" : "Rastreamento permitido, mas sem a linha Sitemap:",
    },
    {
      id: "https",
      level: settings.siteUrl.startsWith("https://") ? "good" : "warning",
      label: "HTTPS",
      description: settings.siteUrl.startsWith("https://") ? `Site em ${settings.siteUrl}` : `URL do site sem HTTPS (${settings.siteUrl}). Use HTTPS em produção.`,
    },
    {
      id: "noindex",
      level: published.length - indexable.length ? "warning" : "good",
      label: `${published.length - indexable.length} post(s) publicados com noindex`,
      description: "Posts marcados para não aparecer no Google",
    },
    { id: "dup-titles", level: dupTitles.length ? "error" : "good", label: `${dupTitles.length} título(s) duplicado(s)`, description: dupTitles.length ? dupTitles.map((g) => `"${g[0].title}"`).join(", ") : "Todos os títulos são únicos" },
    { id: "dup-descs", level: dupDescs.length ? "warning" : "good", label: `${dupDescs.length} meta description(s) repetida(s)`, description: dupDescs.length ? dupDescs.map((g) => g.map((p) => `"${p.title}"`).join(" = ")).join("; ") : "Todas as descrições são únicas" },
    { id: "no-desc", level: noDesc.length ? "warning" : "good", label: `${noDesc.length} post(s) sem meta description`, description: "Sem meta description nem resumo" },
    { id: "no-keyword", level: noKeyword.length ? "warning" : "good", label: `${noKeyword.length} post(s) sem palavra-chave`, description: "Defina a palavra-chave principal no editor" },
    { id: "alt", level: imagesNoAlt ? "warning" : "good", label: `${imagesNoAlt} imagem(ns) sem texto alternativo`, description: "Afeta acessibilidade e busca de imagens", href: "/painel/midia" },
    { id: "broken", level: broken.length ? "error" : "good", label: `${broken.length} post(s) com links internos quebrados`, description: broken.map((p) => `"${p.title}"`).join(", ") || "Nenhum link quebrado" },
  ]

  // mapa de palavras-chave: quem disputa o quê
  const kwMap = new Map<string, { keyword: string; posts: { id: number; title: string; score: number; status: string }[] }>()
  for (const p of posts) {
    const k = normalize(p.focusKeyword)
    if (!k) continue
    const entry = kwMap.get(k) ?? { keyword: p.focusKeyword.trim(), posts: [] }
    entry.posts.push({ id: p.id, title: p.title, score: p.seoScore, status: p.status })
    kwMap.set(k, entry)
  }
  const keywords = [...kwMap.values()]
    .map((k) => ({ ...k, conflict: k.posts.length > 1 }))
    .sort((a, b) => Number(b.conflict) - Number(a.conflict) || a.keyword.localeCompare(b.keyword))

  return {
    kpis: {
      avgScore: avg,
      below65: posts.filter((p) => p.seoScore < 65).length,
      published: published.length,
      indexable: indexable.length,
      imagesWithoutAlt: imagesNoAlt,
      distribution: {
        good: posts.filter((p) => p.seoScore >= 80).length,
        ok: posts.filter((p) => p.seoScore >= 65 && p.seoScore < 80).length,
        poor: posts.filter((p) => p.seoScore < 65).length,
      },
    },
    toFix: posts.slice(0, 8).map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      score: p.seoScore,
      img: p.cover ? mediaUrl(p.cover) : "",
      issue: topIssue(parseChecks(p.seoReport)),
    })),
    health,
    keywords,
  }
}

// ---------- sitemap e robots ----------

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!)

export async function sitemapXml() {
  const settings = await getSettings()
  const site = settings.siteUrl.replace(/\/$/, "")
  const posts = await prisma.post.findMany({
    where: { status: "published", index: true },
    select: { slug: true, updatedAt: true, canonicalUrl: true },
    orderBy: { publishedAt: "desc" },
  })
  const urls = [
    `<url><loc>${xmlEscape(site)}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    // posts com canônica externa ficam de fora: o sitemap só lista URLs canônicas deste site
    ...posts
      .filter((p) => !p.canonicalUrl || p.canonicalUrl.startsWith(site))
      .map((p) => `<url><loc>${xmlEscape(`${site}/post/${p.slug}`)}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod><priority>0.8</priority></url>`),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`
}

export const robotsTxt = async () => (await getSettings()).robots

// ---------- redirecionamentos 301 ----------

const normPath = (p: string) => {
  const t = p.trim()
  if (/^https?:\/\//i.test(t)) return t
  return ("/" + t.replace(/^\/+/, "")).replace(/(.)\/+$/, "$1")
}

export const listRedirects = () => prisma.redirect.findMany({ orderBy: { createdAt: "desc" } })

export async function createRedirect(fromRaw: string, toRaw: string) {
  const from = normPath(fromRaw)
  const to = normPath(toRaw)
  if (/^https?:\/\//i.test(from)) throw badRequest("A origem deve ser um caminho do site, como /url-antiga")
  if (/^\/(api|painel|login|uploads)(\/|$)/.test(from)) throw badRequest("Essa origem é reservada pelo sistema")
  // Destino: caminho do site ou URL http(s). Nada de javascript:, data:, //outro-site etc.
  if (!/^\/(?!\/)\S*$/.test(to) && !/^https?:\/\/[^\s/]+(\/\S*)?$/i.test(to)) throw badRequest("Destino inválido: use /caminho ou https://site.com/...")
  if (from === to) throw badRequest("Origem e destino são iguais")
  if (await prisma.redirect.findUnique({ where: { from } })) throw conflict(`Já existe um redirecionamento de ${from}`)
  const loop = await prisma.redirect.findUnique({ where: { from: to } })
  if (loop?.to === from) throw badRequest("Isso criaria um loop de redirecionamento")
  return prisma.redirect.create({ data: { from, to } })
}

export async function deleteRedirect(id: number) {
  if (!(await prisma.redirect.findUnique({ where: { id } }))) throw notFound("Redirecionamento não encontrado")
  await prisma.redirect.delete({ where: { id } })
}

/** Usado pelo site público: devolve o destino e conta o acesso. */
export async function resolveRedirect(path: string) {
  const r = await prisma.redirect.findUnique({ where: { from: normPath(path) } })
  if (!r) return null
  await prisma.redirect.update({ where: { id: r.id }, data: { hits: { increment: 1 } } })
  return r.to
}

/** Ao trocar o slug de um post publicado, a URL antiga passa a redirecionar. */
export async function redirectSlugChange(oldSlug: string, newSlug: string) {
  const from = `/post/${oldSlug}`
  const to = `/post/${newSlug}`
  await prisma.redirect.deleteMany({ where: { from: to } })
  await prisma.redirect.updateMany({ where: { to: from }, data: { to } })
  await prisma.redirect.upsert({ where: { from }, create: { from, to }, update: { to } })
}
