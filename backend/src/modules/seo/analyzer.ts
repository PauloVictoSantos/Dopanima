// Analisador de SEO on-page. Função pura: recebe o conteúdo do post e um contexto
// (outros posts, configurações do site) e devolve nota, checagens e estatísticas.
// Usado pelo editor (análise ao vivo), ao salvar posts e na visão geral de SEO.

import { stripTags, words } from "../../lib/html"

export type SeoStatus = "good" | "warning" | "error"
export type SeoGroup = "keyword" | "meta" | "content" | "readability" | "media" | "links" | "technical"

export type SeoCheck = {
  id: string
  group: SeoGroup
  label: string
  status: SeoStatus
  message: string
  weight: number
}

export type SeoInput = {
  title: string
  slug: string
  excerpt: string
  content: string
  focusKeyword: string
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  index: boolean
  /** null quando não há imagem destacada; string (possivelmente vazia) com o alt quando há. */
  coverAlt: string | null
}

export type SeoContext = {
  siteUrl: string
  /** Ex.: "%titulo% | Dopanima" */
  titleTemplate: string
  /** Outros posts (não inclui o analisado), para checar duplicidades. */
  others: { id: number; title: string; slug: string; focusKeyword: string; metaDescription: string }[]
  /** Slugs de posts publicados, para detectar links internos quebrados. */
  publishedSlugs: Set<string>
}

export type SeoStats = {
  words: number
  readTimeMinutes: number
  sentences: number
  paragraphs: number
  avgSentenceLength: number
  longSentencesPct: number
  transitionPct: number
  fleschScore: number
  keywordCount: number
  keywordDensity: number
  headings: number
  images: number
  imagesWithoutAlt: number
  internalLinks: number
  externalLinks: number
  brokenLinks: string[]
}

export type SeoReport = {
  score: number
  grade: "good" | "ok" | "poor"
  checks: SeoCheck[]
  stats: SeoStats
  preview: { title: string; url: string; description: string }
}

// ---------- helpers de texto ----------

/** Minúsculas e sem acentos, para comparar palavras-chave. */
export const normalize = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Ocorrências da frase-chave como palavras inteiras. */
export function countPhrase(text: string, phrase: string) {
  const p = normalize(phrase)
  if (!p) return 0
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(p).replace(/\s+/g, "\\s+")}(?=$|[^a-z0-9])`, "g")
  return (normalize(text).match(re) ?? []).length
}

const contains = (text: string, phrase: string) => countPhrase(text, phrase) > 0

/** Sílabas aproximadas em português: grupos de vogais. */
const syllables = (word: string) => Math.max(1, (normalize(word).match(/[aeiouy]+/g) ?? []).length)

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0)

const TRANSITIONS = [
  "alem disso", "portanto", "no entanto", "por exemplo", "assim", "enquanto", "porem", "contudo", "entretanto",
  "ou seja", "em resumo", "finalmente", "primeiro", "por fim", "ainda assim", "dessa forma", "afinal", "tambem",
  "mas", "logo", "pois", "alias", "inclusive", "em seguida", "depois", "por isso", "em contrapartida", "todavia",
]

const tagTexts = (html: string, tag: string) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((m) => stripTags(m[1]).trim())

const attr = (tagHtml: string, name: string) => tagHtml.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1]

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s)

export const seoTitle = (input: Pick<SeoInput, "metaTitle" | "title">, template: string) =>
  (template || "%titulo%").replace("%titulo%", (input.metaTitle || input.title).trim())

// ---------- análise ----------

export function analyzeSeo(input: SeoInput, ctx: SeoContext): SeoReport {
  const html = input.content || ""
  const text = stripTags(html)
  const allWords = words(text)
  const totalWords = allWords.length
  const sentences = splitSentences(text)
  const paragraphs = tagTexts(html, "p").filter(Boolean)
  const headings = [...tagTexts(html, "h2"), ...tagTexts(html, "h3"), ...tagTexts(html, "h4")]
  const kw = input.focusKeyword.trim()
  const kwWords = words(kw).length || 1
  const metaDesc = (input.metaDescription || input.excerpt).trim()
  const title = seoTitle(input, ctx.titleTemplate)

  // imagens e links do corpo
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? []
  const imgAlts = imgTags.map((t) => (attr(t, "alt") ?? "").trim())
  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]*)"/gi)].map((m) => m[1].trim()).filter((h) => h && h !== "#")
  const site = ctx.siteUrl.replace(/\/$/, "")
  const isInternal = (h: string) => h.startsWith("/") || (!!site && h.startsWith(site))
  const internal = hrefs.filter(isInternal)
  const external = hrefs.filter((h) => /^https?:\/\//i.test(h) && !isInternal(h))
  const brokenLinks = internal.filter((h) => {
    const m = h.replace(site, "").match(/^\/post\/([^/?#]+)/)
    return m ? !ctx.publishedSlugs.has(m[1]) : false
  })

  // legibilidade
  const syl = allWords.reduce((a, w) => a + syllables(w), 0)
  const asl = sentences.length ? totalWords / sentences.length : 0
  const flesch = totalWords ? Math.round(Math.min(100, Math.max(0, 248.835 - 1.015 * asl - 84.6 * (syl / totalWords)))) : 0
  const longSentencesPct = sentences.length ? Math.round((sentences.filter((s) => words(s).length > 25).length / sentences.length) * 100) : 0
  const transitionPct = sentences.length
    ? Math.round((sentences.filter((s) => TRANSITIONS.some((t) => contains(s, t))).length / sentences.length) * 100)
    : 0

  const kwCount = kw ? countPhrase(text, kw) : 0
  const density = totalWords && kw ? +(((kwCount * kwWords) / totalWords) * 100).toFixed(2) : 0

  const checks: SeoCheck[] = []
  const add = (id: string, group: SeoGroup, label: string, status: SeoStatus, message: string, weight = 2) =>
    checks.push({ id, group, label, status, message, weight })

  // --- palavra-chave ---
  if (!kw) {
    add("kw-defined", "keyword", "Palavra-chave principal", "error", "Defina uma palavra-chave principal para o post.", 5)
  } else {
    add("kw-defined", "keyword", "Palavra-chave principal", "good", `Palavra-chave: "${kw}".`, 1)

    const inTitle = contains(title, kw)
    const atStart = normalize(input.metaTitle || input.title).startsWith(normalize(kw))
    add("kw-title", "keyword", "Palavra-chave no título", inTitle ? "good" : "error",
      inTitle ? (atStart ? "Aparece logo no início do título. Ótimo." : "Aparece no título. Melhor ainda se vier no começo.") : "Inclua a palavra-chave no título SEO.", 3)

    add("kw-meta", "keyword", "Palavra-chave na meta description", contains(metaDesc, kw) ? "good" : "warning",
      contains(metaDesc, kw) ? "A meta description cita a palavra-chave." : "Use a palavra-chave na meta description.", 2)

    const kwSlug = normalize(kw).replace(/[^a-z0-9]+/g, "-")
    add("kw-slug", "keyword", "Palavra-chave na URL", input.slug.includes(kwSlug) ? "good" : "warning",
      input.slug.includes(kwSlug) ? "A URL contém a palavra-chave." : `Considere usar "${kwSlug}" na URL.`, 1)

    const intro = paragraphs[0] ?? allWords.slice(0, 100).join(" ")
    add("kw-intro", "keyword", "Palavra-chave na introdução", contains(intro, kw) ? "good" : "warning",
      contains(intro, kw) ? "Aparece no primeiro parágrafo." : "Cite a palavra-chave no primeiro parágrafo.", 2)

    const dStatus: SeoStatus = density === 0 ? "error" : density < 0.5 || density > 2.5 ? "warning" : "good"
    add("kw-density", "keyword", "Densidade da palavra-chave", density > 4 ? "error" : dStatus,
      density === 0 ? "A palavra-chave não aparece no texto."
        : density > 2.5 ? `Densidade de ${density}% (${kwCount}x). Parece repetição excessiva; o ideal é até 2,5%.`
        : density < 0.5 ? `Densidade de ${density}% (${kwCount}x). Use um pouco mais; o ideal é entre 0,5% e 2,5%.`
        : `Densidade de ${density}% (${kwCount}x). Dentro do ideal.`, 2)

    const inHeading = headings.some((h) => contains(h, kw))
    add("kw-headings", "keyword", "Palavra-chave nos subtítulos", inHeading ? "good" : "warning",
      inHeading ? "Pelo menos um subtítulo usa a palavra-chave." : "Use a palavra-chave em um subtítulo (H2 ou H3).", 1)

    const alts = [...imgAlts, ...(input.coverAlt != null ? [input.coverAlt] : [])]
    if (alts.length)
      add("kw-alt", "keyword", "Palavra-chave no texto alternativo", alts.some((a) => contains(a, kw)) ? "good" : "warning",
        alts.some((a) => contains(a, kw)) ? "Uma imagem usa a palavra-chave no alt." : "Descreva ao menos uma imagem com a palavra-chave.", 1)

    const clash = ctx.others.filter((o) => o.focusKeyword && normalize(o.focusKeyword) === normalize(kw))
    add("kw-unique", "keyword", "Palavra-chave inédita", clash.length ? "warning" : "good",
      clash.length ? `Também é foco de: ${clash.map((o) => `"${o.title}"`).join(", ")}. Posts competem entre si no Google.` : "Nenhum outro post disputa essa palavra-chave.", 2)
  }

  // --- meta ---
  const tLen = title.length
  add("title-length", "meta", "Tamanho do título SEO", tLen >= 30 && tLen <= 60 ? "good" : tLen > 70 || tLen < 15 ? "error" : "warning",
    `${tLen} caracteres. ${tLen > 60 ? "O Google pode cortar acima de 60." : tLen < 30 ? "Curto demais; aproveite até 60 caracteres." : "Tamanho ideal."}`, 2)

  const mLen = metaDesc.length
  add("meta-length", "meta", "Tamanho da meta description", !mLen ? "error" : mLen >= 120 && mLen <= 160 ? "good" : mLen < 70 || mLen > 170 ? "error" : "warning",
    !mLen ? "Escreva uma meta description (ou um resumo)." : `${mLen} caracteres${!input.metaDescription ? " (usando o resumo)" : ""}. O ideal é entre 120 e 160.`, 3)

  const sameTitle = ctx.others.find((o) => normalize(o.title) === normalize(input.title))
  add("title-unique", "meta", "Título único", sameTitle ? "error" : "good",
    sameTitle ? `Outro post já usa esse título ("${sameTitle.title}").` : "Nenhum outro post tem esse título.", 2)

  const sameDesc = mLen > 0 && ctx.others.find((o) => o.metaDescription && normalize(o.metaDescription) === normalize(metaDesc))
  add("meta-unique", "meta", "Meta description única", sameDesc ? "warning" : "good",
    sameDesc ? `Igual à de "${sameDesc.title}".` : "Nenhum outro post usa essa descrição.", 1)

  const slugWords = input.slug.split("-").filter(Boolean).length
  add("slug", "meta", "URL amigável", !input.slug ? "error" : input.slug.length <= 60 && slugWords <= 8 ? "good" : "warning",
    !input.slug ? "Defina uma URL (slug)." : input.slug.length > 60 ? `URL com ${input.slug.length} caracteres; prefira até 60.` : "URL curta e legível.", 1)

  // --- conteúdo ---
  add("content-length", "content", "Tamanho do conteúdo", totalWords >= 300 ? "good" : totalWords >= 150 ? "warning" : "error",
    `${totalWords} palavras. ${totalWords >= 300 ? "Bom volume de texto." : "Textos com 300+ palavras tendem a ranquear melhor."}`, 3)

  const longest = Math.max(0, ...paragraphs.map((p) => words(p).length))
  add("paragraphs", "content", "Tamanho dos parágrafos", longest > 150 ? "warning" : "good",
    longest > 150 ? `Há parágrafo com ${longest} palavras; quebre em blocos menores.` : "Parágrafos com tamanho confortável.", 1)

  add("subheadings", "content", "Subtítulos", headings.length ? "good" : totalWords > 300 ? "error" : "warning",
    headings.length ? `${headings.length} subtítulo(s) organizando o texto.` : "Divida o texto com subtítulos (H2/H3).", 2)

  add("excerpt", "content", "Resumo", input.excerpt.trim() ? "good" : "warning",
    input.excerpt.trim() ? "O post tem resumo para cards e redes sociais." : "Escreva um resumo de uma ou duas frases.", 1)

  // --- legibilidade ---
  if (totalWords >= 50) {
    add("flesch", "readability", "Facilidade de leitura", flesch >= 50 ? "good" : flesch >= 30 ? "warning" : "error",
      `Índice Flesch ${flesch}/100 (${flesch >= 75 ? "muito fácil" : flesch >= 50 ? "fácil" : flesch >= 30 ? "difícil" : "muito difícil"}).`, 2)
    add("long-sentences", "readability", "Frases longas", longSentencesPct <= 25 ? "good" : "warning",
      `${longSentencesPct}% das frases têm mais de 25 palavras${longSentencesPct > 25 ? "; o ideal é até 25%." : "."}`, 1)
    add("transitions", "readability", "Palavras de transição", transitionPct >= 30 ? "good" : transitionPct >= 15 ? "warning" : "error",
      `${transitionPct}% das frases usam conectivos ("além disso", "porém"...). O ideal é 30% ou mais.`, 1)
  }

  // --- mídia ---
  add("cover", "media", "Imagem destacada", input.coverAlt != null ? "good" : "error",
    input.coverAlt != null ? "O post tem imagem destacada." : "Escolha uma imagem destacada (aparece no Google e nas redes).", 2)
  if (input.coverAlt != null)
    add("cover-alt", "media", "Alt da imagem destacada", input.coverAlt.trim() ? "good" : "warning",
      input.coverAlt.trim() ? "A imagem destacada tem texto alternativo." : "Preencha o texto alternativo da imagem na biblioteca de mídia.", 1)
  const noAlt = imgAlts.filter((a) => !a).length
  if (imgTags.length)
    add("img-alt", "media", "Alt nas imagens do texto", noAlt ? "warning" : "good",
      noAlt ? `${noAlt} de ${imgTags.length} imagem(ns) sem texto alternativo.` : "Todas as imagens do texto têm alt.", 1)

  // --- links ---
  add("internal-links", "links", "Links internos", internal.length ? "good" : "warning",
    internal.length ? `${internal.length} link(s) para outras páginas do site.` : "Adicione ao menos um link para outro post do site.", 2)
  add("external-links", "links", "Links externos", external.length ? "good" : "warning",
    external.length ? `${external.length} link(s) para fontes externas.` : "Cite uma fonte externa relevante, se fizer sentido.", 1)
  if (brokenLinks.length)
    add("broken-links", "links", "Links internos quebrados", "error", `Apontam para posts inexistentes ou não publicados: ${brokenLinks.join(", ")}.`, 2)

  // --- técnico ---
  add("indexable", "technical", "Indexação", input.index ? "good" : "warning",
    input.index ? "O post pode aparecer no Google." : "Marcado como noindex: não aparecerá nas buscas.", 1)
  if (input.canonicalUrl.trim()) {
    const ok = /^https?:\/\/[^\s]+$/i.test(input.canonicalUrl.trim())
    add("canonical", "technical", "URL canônica", ok ? "good" : "error", ok ? "URL canônica válida." : "A URL canônica precisa ser absoluta (https://...).", 1)
  }

  const total = checks.reduce((a, c) => a + c.weight, 0)
  const got = checks.reduce((a, c) => a + c.weight * (c.status === "good" ? 1 : c.status === "warning" ? 0.5 : 0), 0)
  const score = total ? Math.round((got / total) * 100) : 0

  return {
    score,
    grade: score >= 80 ? "good" : score >= 65 ? "ok" : "poor",
    checks,
    stats: {
      words: totalWords,
      readTimeMinutes: Math.max(1, Math.round(totalWords / 200)),
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      avgSentenceLength: +asl.toFixed(1),
      longSentencesPct,
      transitionPct,
      fleschScore: flesch,
      keywordCount: kwCount,
      keywordDensity: density,
      headings: headings.length,
      images: imgTags.length,
      imagesWithoutAlt: noAlt,
      internalLinks: internal.length,
      externalLinks: external.length,
      brokenLinks,
    },
    preview: {
      title: truncate(title, 60),
      url: `${site}/post/${input.slug}`,
      description: truncate(metaDesc, 160),
    },
  }
}

/** Primeiro problema mais relevante, para listas como "posts para revisar". */
export function topIssue(checks: Pick<SeoCheck, "status" | "label" | "message" | "weight">[]) {
  const bad = [...checks].filter((c) => c.status !== "good").sort((a, b) => (a.status === b.status ? b.weight - a.weight : a.status === "error" ? -1 : 1))
  return bad[0] ? `${bad[0].label}: ${bad[0].message}` : "Tudo certo"
}
