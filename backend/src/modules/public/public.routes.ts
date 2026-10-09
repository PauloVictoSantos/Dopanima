// API consumida pelo site público (sem autenticação). Só expõe posts publicados.

import { Router } from "express"
import rateLimit from "express-rate-limit"
import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { CATEGORY_TYPE } from "../../lib/constants"
import { sanitize } from "../../lib/html"
import { badRequest, notFound } from "../../lib/http-error"
import { hashIp } from "../../lib/security"
import { authenticateSite } from "../../middlewares/auth"
import { classify, getModeration, publicComments, refreshCounts } from "../comments/comments.service"
import { todayKey } from "../stats/stats.routes"
import { prisma } from "../../lib/prisma"
import { parse } from "../../lib/validate"
import { postInclude, postType, toPublicPost } from "../posts/posts.mapper"
import { seoTitle } from "../seo/analyzer"
import { resolveRedirect, robotsTxt, sitemapXml } from "../seo/seo.service"
import { getSettings } from "../seo/settings.service"
import { listTags } from "../tags/tags.routes"

const live = (): Prisma.PostWhereInput => ({ status: "published", publishedAt: { lte: new Date() } })

const slugsOfType = (type: string) => Object.entries(CATEGORY_TYPE).filter(([, t]) => t === type).map(([slug]) => slug)

const findPosts = (where: Prisma.PostWhereInput, opts: { take?: number; skip?: number; orderBy?: Prisma.PostOrderByWithRelationInput } = {}) =>
  prisma.post.findMany({ where: { ...live(), ...where }, include: postInclude, orderBy: opts.orderBy ?? { publishedAt: "desc" }, take: opts.take, skip: opts.skip })

const listSchema = z.object({
  q: z.string().trim().default(""),
  type: z.enum(["filme", "livro", "serie", "noticia"]).optional(),
  category: z.string().trim().optional(),
  sub: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  sort: z.enum(["recent", "popular"]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
})

export const publicRouter = Router()

publicRouter.get("/settings", async (_req, res) => {
  const { robots: _robots, ...s } = await getSettings()
  res.json(s)
})

publicRouter.get("/home", async (_req, res) => {
  const [featured, latest, films, books] = await Promise.all([
    findPosts({ featured: true }, { take: 5 }),
    findPosts({}, { take: 60 }),
    findPosts({ category: { slug: { in: slugsOfType("filme") } } }, { take: 5, orderBy: { views: "desc" } }),
    findPosts({ category: { slug: { in: slugsOfType("livro") } } }, { take: 5, orderBy: { views: "desc" } }),
  ])
  // Destaques marcados no painel; completa com os mais recentes se faltar.
  const hero = [...featured, ...latest.filter((p) => !featured.some((f) => f.id === p.id))].slice(0, 5)
  res.json({
    hero: hero.map(toPublicPost),
    filmFeatures: films.slice(0, 3).map(toPublicPost),
    bookFeatures: books.slice(0, 3).map(toPublicPost),
    picks: {
      film: films[3] ? toPublicPost(films[3]) : films[0] ? toPublicPost(films[0]) : null,
      book: books[3] ? toPublicPost(books[3]) : books[0] ? toPublicPost(books[0]) : null,
    },
    posts: latest.map(toPublicPost),
  })
})

publicRouter.get("/posts", async (req, res) => {
  const q = parse(listSchema, req.query)
  const where: Prisma.PostWhereInput = {
    ...(q.q ? { OR: [{ title: { contains: q.q } }, { subtitle: { contains: q.q } }, { excerpt: { contains: q.q } }] } : {}),
    ...(q.type ? { category: { slug: { in: slugsOfType(q.type) } } } : {}),
    ...(q.category ? { category: { slug: q.category } } : {}),
    ...(q.sub ? { subcategory: { slug: q.sub } } : {}),
    ...(q.tag ? { tags: { some: { tag: { slug: q.tag } } } } : {}),
  }
  const [items, total] = await Promise.all([
    findPosts(where, { take: q.limit, skip: (q.page - 1) * q.limit, orderBy: q.sort === "popular" ? { views: "desc" } : undefined }),
    prisma.post.count({ where: { ...live(), ...where } }),
  ])
  res.json({ items: items.map(toPublicPost), total, page: q.page, limit: q.limit })
})

publicRouter.get("/posts/:slug", async (req, res) => {
  const post = await prisma.post.findFirst({ where: { ...live(), slug: String(req.params.slug) }, include: postInclude })
  if (!post) throw notFound("Post não encontrado")
  const settings = await getSettings()
  const site = settings.siteUrl.replace(/\/$/, "")
  const sameType = await findPosts({ id: { not: post.id }, category: { slug: { in: slugsOfType(postType(post)) } } }, { take: 3 })
  const dto = toPublicPost(post)
  res.json({
    post: {
      ...dto,
      // Sanitizado de novo na saída (defesa extra caso algo tenha entrado direto no banco).
      contentHtml: sanitize(post.content),
      seo: {
        title: seoTitle(post, settings.titleTemplate),
        description: post.metaDescription || post.excerpt || settings.defaultMetaDescription,
        canonical: post.canonicalUrl || `${site}/post/${post.slug}`,
        index: post.index,
        follow: post.follow,
        image: dto.img || settings.ogImage,
        imageAlt: dto.imgAlt,
        keywords: [post.focusKeyword, ...dto.tags.map((t) => t.name)].filter(Boolean),
        publishedTime: post.publishedAt,
        modifiedTime: post.updatedAt,
        section: post.category?.name ?? "",
      },
    },
    related: sameType.map(toPublicPost),
  })
})

// ---------- visualizações ----------

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|brave)\./
const SOCIAL = /(^|\.)(facebook|fb|instagram|t\.co|twitter|x\.com|linkedin|lnkd|whatsapp|wa\.me|reddit|pinterest|tiktok|youtube|threads|bsky|telegram)\b/

/** Origem da visita a partir do referrer: busca, social, direto ou referência. */
function sourceOf(referrer: string, siteUrl: string) {
  let host = ""
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "")
  } catch {
    return "direto"
  }
  try {
    if (host === new URL(siteUrl).hostname.replace(/^www\./, "")) return "direto"
  } catch {}
  if (SEARCH.test(host + ".")) return "busca"
  if (SOCIAL.test(host)) return "social"
  return "referencia"
}

// A mesma pessoa (IP) abrindo o mesmo post conta 1 vez a cada 30 min.
const recentViews = new Map<string, number>()
const VIEW_TTL = 30 * 60_000

const viewLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Muitas requisições" } })

/** Conta uma visualização. Chamado pelo navegador ao abrir o post. */
publicRouter.post("/posts/:slug/view", viewLimiter, async (req, res) => {
  const slug = String(req.params.slug).slice(0, 191)
  const post = await prisma.post.findFirst({ where: { ...live(), slug }, select: { id: true } })
  if (!post) throw notFound("Post não encontrado")

  const key = `${hashIp(req.ip)}:${post.id}`
  const now = Date.now()
  if ((recentViews.get(key) ?? 0) > now - VIEW_TTL) {
    res.status(204).end()
    return
  }
  if (recentViews.size > 50_000) for (const [k, t] of recentViews) if (t < now - VIEW_TTL) recentViews.delete(k)
  recentViews.set(key, now)

  const referrer = typeof req.body?.referrer === "string" ? req.body.referrer.slice(0, 500) : ""
  const source = sourceOf(referrer, (await getSettings()).siteUrl)
  const day = todayKey()
  await prisma.$transaction([
    prisma.post.update({ where: { id: post.id }, data: { views: { increment: 1 } } }),
    prisma.postViewDaily.upsert({
      where: { postId_day_source: { postId: post.id, day, source } },
      create: { postId: post.id, day, source, views: 1 },
      update: { views: { increment: 1 } },
    }),
  ])
  res.status(204).end()
})

// ---------- comentários ----------

publicRouter.get("/posts/:slug/comments", async (req, res) => {
  const post = await prisma.post.findFirst({ where: { ...live(), slug: String(req.params.slug) }, select: { id: true } })
  if (!post) throw notFound("Post não encontrado")
  res.json(await publicComments(post.id))
})

// Comentar exige conta no blog: nome e e-mail vêm do cadastro.
const commentSchema = z.object({
  content: z.string().trim().min(3, "Escreva um comentário com pelo menos 3 caracteres.").max(2000, "Comentário longo demais (máx. 2000 caracteres)."),
  /** Campo isca: invisível para pessoas, robôs costumam preencher. */
  website: z.string().max(200).optional(),
})

const commentLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Você comentou muitas vezes seguidas. Aguarde alguns minutos." },
})

publicRouter.post("/posts/:slug/comments", authenticateSite, commentLimiter, async (req, res) => {
  const data = parse(commentSchema, req.body)
  const user = req.user!
  const post = await prisma.post.findFirst({ where: { ...live(), slug: String(req.params.slug) }, select: { id: true } })
  if (!post) throw notFound("Post não encontrado")

  const ipHash = hashIp(req.ip)
  const dup = await prisma.comment.findFirst({ where: { userId: user.id, content: data.content, createdAt: { gte: new Date(Date.now() - 86_400_000) } }, select: { id: true } })
  if (dup) throw badRequest("Você já enviou esse comentário.")

  const status = data.website
    ? "spam"
    : user.role !== "reader"
      ? "approved" // equipe do blog publica direto
      : await classify({ content: data.content, name: user.name, userId: user.id }, await getModeration())
  await prisma.comment.create({
    data: {
      postId: post.id,
      userId: user.id,
      authorName: user.name,
      authorEmail: user.email,
      content: data.content,
      status,
      ipHash,
      userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300),
    },
  })
  if (status === "approved") await refreshCounts([post.id])
  // Spam recebe a mesma resposta de "pendente", para não ensinar o robô a burlar o filtro.
  res.status(201).json({ status: status === "approved" ? "approved" : "pending" })
})

publicRouter.get("/categories", async (_req, res) => {
  const cats = await prisma.category.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    include: { _count: { select: { posts: { where: live() }, subPosts: { where: live() } } } },
  })
  res.json(
    cats
      .filter((c) => !c.parentId)
      .map((root) => ({
        id: root.id,
        name: root.name,
        slug: root.slug,
        description: root.description,
        color: root.color,
        type: CATEGORY_TYPE[root.slug] ?? null,
        count: root._count.posts,
        children: cats
          .filter((c) => c.parentId === root.id)
          .map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, count: c._count.subPosts })),
      }))
  )
})

publicRouter.get("/tags", async (_req, res) => {
  res.json((await listTags()).filter((t) => t.count > 0))
})

publicRouter.get("/redirects/resolve", async (req, res) => {
  const { path } = parse(z.object({ path: z.string().min(1).max(500) }), req.query)
  const to = await resolveRedirect(path)
  if (!to) throw notFound("Sem redirecionamento")
  res.json({ to, permanent: true })
})

/** /sitemap.xml e /robots.txt na raiz da API (o frontend reescreve para cá). */
export const seoFilesRouter = Router()

seoFilesRouter.get("/sitemap.xml", async (_req, res) => {
  res.type("application/xml").send(await sitemapXml())
})

seoFilesRouter.get("/robots.txt", async (_req, res) => {
  res.type("text/plain").send(await robotsTxt())
})
