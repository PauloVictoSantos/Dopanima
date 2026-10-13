import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { imageSize } from "image-size"
import { env } from "../../config/env"
import { HttpError } from "../../lib/http-error"
import { HOUR, booksGet, coverUrl, downloadCover } from "../../lib/google-books"
import { mediaUrl } from "../../lib/media-url"
import { prisma } from "../../lib/prisma"
import { UPLOAD_PATH } from "../../middlewares/upload"
import { signature } from "../tmdb/tmdb.service"

// ---------- formatos do Google Books (só o que usamos) ----------

type ImageLinks = Partial<Record<"smallThumbnail" | "thumbnail" | "small" | "medium" | "large" | "extraLarge", string>>
type RawVolume = {
  id: string
  volumeInfo: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    industryIdentifiers?: { type: string; identifier: string }[]
    pageCount?: number
    categories?: string[]
    averageRating?: number
    ratingsCount?: number
    imageLinks?: ImageLinks
    language?: string
    infoLink?: string
    canonicalVolumeLink?: string
  }
}

// ---------- formatos que a API do blog devolve ----------

export type BookCard = {
  id: string
  title: string
  subtitle: string
  authors: string[]
  year: string
  cover: string
  /** Página do livro no Google Books. */
  url: string
  /** Post publicado do blog sobre este livro, se houver. */
  postSlug?: string
  postRating?: number | null
}

const year = (d?: string) => (d ? d.slice(0, 4) : "")
const bookUrl = (v: RawVolume) => v.volumeInfo.canonicalVolumeLink || v.volumeInfo.infoLink || `https://books.google.com/books?id=${v.id}`

/** A descrição vem em HTML simples; vira texto puro com parágrafos separados por linha em branco. */
const plain = (html = "") =>
  html
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n")

const toCard = (v: RawVolume): BookCard => ({
  id: v.id,
  title: v.volumeInfo.title ?? "",
  subtitle: v.volumeInfo.subtitle ?? "",
  authors: v.volumeInfo.authors ?? [],
  year: year(v.volumeInfo.publishedDate),
  cover: coverUrl(v.volumeInfo.imageLinks?.thumbnail ?? v.volumeInfo.imageLinks?.smallThumbnail),
  url: bookUrl(v),
})

/** Marca os livros que já têm post publicado no blog (o card leva para o post). */
async function attachPosts<T extends { id: string; postSlug?: string; postRating?: number | null }>(cards: T[]): Promise<T[]> {
  if (!cards.length) return cards
  const posts = await prisma.post.findMany({
    where: { status: "published", publishedAt: { lte: new Date() }, googleBooksId: { in: cards.map((c) => c.id) } },
    select: { slug: true, googleBooksId: true, authorRating: true },
  })
  return cards.map((c) => {
    const p = posts.find((x) => x.googleBooksId === c.id)
    return { ...c, postSlug: p?.slug, postRating: p?.authorRating ?? null }
  })
}

const lang = () => env.GOOGLE_BOOKS_LANGUAGE || undefined

// ---------- busca ----------

/**
 * `field` restringe a busca: título, autor ou ISBN. Com "all", um texto que parece ISBN
 * (10 ou 13 dígitos) é buscado como ISBN.
 */
export async function search(q: string, field: "all" | "title" | "author" | "isbn" = "all", page = 1) {
  const digits = q.replace(/[^0-9Xx]/g, "")
  const isIsbn = field === "isbn" || (field === "all" && /^(\d{9}[\dXx]|\d{13})$/.test(digits) && q.replace(/[\s-]/g, "").length === digits.length)
  const term = isIsbn ? `isbn:${digits}` : field === "title" ? `intitle:${q}` : field === "author" ? `inauthor:${q}` : q
  const data = await booksGet<{ items?: RawVolume[]; totalItems: number }>(
    "/volumes",
    { q: term, printType: "books", maxResults: 20, startIndex: (page - 1) * 20, langRestrict: isIsbn ? undefined : lang() },
    HOUR
  )
  return { items: await attachPosts((data.items ?? []).map(toCard)), total: data.totalItems }
}

// ---------- ficha completa ----------

/** Maior capa disponível no volume. */
const bestCover = (links: ImageLinks | undefined, width = 800) => {
  if (!links) return ""
  const big = links.extraLarge ?? links.large ?? links.medium ?? links.small
  return big ? coverUrl(big) : coverUrl(links.thumbnail ?? links.smallThumbnail, width)
}

async function moreByAuthor(v: RawVolume) {
  const author = v.volumeInfo.authors?.[0]
  if (!author) return []
  const data = await booksGet<{ items?: RawVolume[] }>("/volumes", { q: author, printType: "books", maxResults: 20, orderBy: "relevance", langRestrict: lang() }, 24 * HOUR).catch(
    () => ({ items: [] as RawVolume[] })
  )
  const seen = new Set([v.volumeInfo.title?.toLowerCase()])
  const cards = (data.items ?? [])
    .filter((x) => x.id !== v.id && x.volumeInfo.imageLinks?.thumbnail)
    .filter((x) => {
      const t = x.volumeInfo.title?.toLowerCase()
      if (seen.has(t)) return false
      seen.add(t)
      return true
    })
    .slice(0, 10)
    .map(toCard)
  return attachPosts(cards)
}

export async function details(id: string) {
  const v = await booksGet<RawVolume>(`/volumes/${encodeURIComponent(id)}`)
  const i = v.volumeInfo
  const isbn = (type: string) => i.industryIdentifiers?.find((x) => x.type === type)?.identifier ?? ""
  return {
    ...toCard(v),
    coverLarge: bestCover(i.imageLinks),
    publisher: i.publisher ?? "",
    publishedDate: i.publishedDate ?? "",
    description: plain(i.description),
    pageCount: i.pageCount ?? null,
    /** O Google manda categorias como "Fiction / Horror": fica só a parte mais específica, sem repetir. */
    categories: [...new Set((i.categories ?? []).map((c) => c.split("/").pop()!.trim()))],
    isbn13: isbn("ISBN_13"),
    isbn10: isbn("ISBN_10"),
    language: i.language ?? "",
    /** Nota média do público, convertida de 0–5 para 0–10 (mesma escala da nota do autor). */
    rating: i.averageRating ? Math.round(i.averageRating * 20) / 10 : 0,
    votes: i.ratingsCount ?? 0,
    moreByAuthor: await moreByAuthor(v),
  }
}

// ---------- importar capa para a biblioteca de mídia ----------

/**
 * Baixa a capa do livro e salva na biblioteca de mídia (pasta "Capas"), com texto
 * alternativo e crédito. Se a capa já foi importada, reaproveita.
 */
export async function importCover(userId: number, id: string) {
  const name = `google-books-${id}-cover`
  const existing = await prisma.media.findFirst({ where: { name } })
  if (existing) return { id: existing.id, url: mediaUrl(existing), alt: existing.alt, reused: true }

  const v = await booksGet<RawVolume>(`/volumes/${encodeURIComponent(id)}`)
  const url = bestCover(v.volumeInfo.imageLinks)
  if (!url) throw new HttpError(404, "Este livro não tem capa no Google Books")
  const buf = await downloadCover(url)
  const sig = signature(buf)
  if (!sig) throw new HttpError(502, "O Google Books devolveu um arquivo que não é imagem")
  const dims = imageSize(buf)
  // Sem capa, o Google devolve uma imagem genérica pequena ("image not available").
  if ((dims.width ?? 0) < 60) throw new HttpError(404, "Este livro não tem capa no Google Books")

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${sig.ext}`
  await fs.writeFile(path.join(UPLOAD_PATH, filename), buf)
  const i = v.volumeInfo
  const authors = (i.authors ?? []).join(", ")
  const m = await prisma.media.create({
    data: {
      name,
      filename,
      mimeType: sig.mime,
      type: "image",
      size: buf.length,
      width: dims.width ?? null,
      height: dims.height ?? null,
      alt: `Capa do livro ${i.title ?? ""}${authors ? `, de ${authors}` : ""}`.slice(0, 300),
      caption: "Imagem: Google Books",
      description: `Importada do Google Books: ${bookUrl(v)}`,
      folder: "Capas",
      uploaderId: userId,
    },
  })
  return { id: m.id, url: mediaUrl(m), alt: m.alt, reused: false }
}

// ---------- sugestões do que ler ----------

/**
 * O Google Books não tem listas de mais vendidos e as buscas por assunto ("subject:")
 * trazem muita coisa irrelevante. Cada aba junta livros de autores conhecidos do gênero,
 * em edições em português.
 */
export const LISTS = {
  fantasy: { title: "Fantasia", authors: ["J. R. R. Tolkien", "George R. R. Martin", "Brandon Sanderson", "Neil Gaiman", "Rick Riordan", "Leigh Bardugo"] },
  horror: { title: "Terror", authors: ["Stephen King", "H. P. Lovecraft", "Edgar Allan Poe", "Shirley Jackson", "Joe Hill", "Clive Barker"] },
  thriller: { title: "Suspense", authors: ["Agatha Christie", "Freida McFadden", "Raphael Montes", "Harlan Coben", "Gillian Flynn", "Dan Brown"] },
  scifi: { title: "Ficção científica", authors: ["Isaac Asimov", "Frank Herbert", "Philip K. Dick", "Ursula K. Le Guin", "Andy Weir", "Ray Bradbury"] },
  romance: { title: "Romance", authors: ["Colleen Hoover", "Taylor Jenkins Reid", "Jane Austen", "Emily Henry", "Jojo Moyes", "Nicholas Sparks"] },
  brazil: { title: "Literatura brasileira", authors: ["Machado de Assis", "Clarice Lispector", "Jorge Amado", "Itamar Vieira Junior", "Conceição Evaristo", "Graciliano Ramos"] },
  comics: { title: "HQs e mangás", authors: ["Mauricio de Sousa", "Alan Moore", "Neil Gaiman", "Akira Toriyama", "Eiichiro Oda", "Frank Miller"] },
} as const
export type ListKey = keyof typeof LISTS

/** Calendários, resumos, amostras e afins que aparecem nas buscas por autor. */
const JUNK = /calend[aá]r|sampler|resumo|summary|fiche de lecture|study guide|guia de estudo|coloring|colorir/i

/** Última lista boa de cada aba: se o Google falhar depois, a home continua com ela. */
const lastGood = new Map<ListKey, BookCard[]>()

/** "Harry Potter e a Pedra Filosofal (Edição Especial)" e "Harry Potter e a pedra filosofal" contam como o mesmo livro. */
const titleKey = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s*[:(\-–].*$/, "").trim()

export async function suggestions(list: ListKey) {
  // Um autor por vez (a cota do Google é por minuto) e para no primeiro erro: se o Google
  // está fora do ar, insistir com os outros autores só gasta cota.
  const perAuthor: RawVolume[][] = []
  for (const author of LISTS[list].authors) {
    let items: RawVolume[]
    try {
      items = (
        await booksGet<{ items?: RawVolume[] }>("/volumes", { q: author, printType: "books", orderBy: "relevance", maxResults: 20, langRestrict: lang() }, 24 * HOUR)
      ).items ?? []
    } catch {
      break
    }
    // Quando instável, o Google às vezes responde com livros de outros autores: confere o sobrenome.
    const surname = author.split(" ").pop()!.toLowerCase()
    const own = items.filter(
      (v) =>
        v.volumeInfo.imageLinks?.thumbnail &&
        v.volumeInfo.title &&
        !JUNK.test(v.volumeInfo.title) &&
        v.volumeInfo.authors?.some((a) => a.toLowerCase().includes(surname))
    )
    // Busca simples ignora o filtro de idioma: prefere as edições no idioma do site, se houver.
    const inLang = lang() ? own.filter((v) => v.volumeInfo.language?.startsWith(lang()!)) : own
    perAuthor.push((inLang.length >= 2 ? inLang : own).slice(0, 4))
  }

  // Intercala os autores (1º de cada, depois 2º de cada...) para a fileira ficar variada.
  const seen = new Set<string>()
  const picked: RawVolume[] = []
  for (let i = 0; picked.length < 20 && perAuthor.some((l) => l.length > i); i++) {
    for (const l of perAuthor) {
      const v = l[i]
      if (!v || picked.length >= 20) continue
      const k = titleKey(v.volumeInfo.title!)
      if (seen.has(k)) continue
      seen.add(k)
      picked.push(v)
    }
  }

  if (!picked.length) {
    const stale = lastGood.get(list)
    if (stale) return attachPosts(stale)
    throw new HttpError(503, "O Google Books não respondeu")
  }
  const cards = picked.map(toCard)
  lastGood.set(list, cards)
  return attachPosts(cards)
}
