import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { imageSize } from "image-size"
import { env } from "../../config/env"
import { HttpError, badRequest } from "../../lib/http-error"
import { mediaUrl } from "../../lib/media-url"
import { prisma } from "../../lib/prisma"
import { HOUR, downloadTmdbImage, tmdbGet, tmdbImage } from "../../lib/tmdb"
import { UPLOAD_PATH } from "../../middlewares/upload"

export type TmdbType = "movie" | "tv"

// ---------- formatos da TMDB (só o que usamos) ----------

type RawItem = {
  id: number
  media_type?: string
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string
  vote_average?: number
  vote_count?: number
}
type RawImage = { file_path: string; width: number; height: number; iso_639_1: string | null; vote_average: number }
type RawProvider = { provider_id: number; provider_name: string; logo_path: string }
type RawDetails = RawItem & {
  tagline?: string
  runtime?: number
  episode_run_time?: number[]
  number_of_seasons?: number
  number_of_episodes?: number
  status?: string
  genres?: { id: number; name: string }[]
  created_by?: { name: string }[]
  credits?: { cast: { name: string; character: string; profile_path: string | null; order: number }[]; crew: { name: string; job: string }[] }
  videos?: { results: { key: string; site: string; type: string; name: string; iso_639_1: string; official: boolean }[] }
  images?: { posters: RawImage[]; backdrops: RawImage[] }
  "watch/providers"?: { results: Record<string, { link?: string; flatrate?: RawProvider[]; rent?: RawProvider[]; buy?: RawProvider[]; free?: RawProvider[]; ads?: RawProvider[] }> }
  recommendations?: { results: RawItem[] }
  similar?: { results: RawItem[] }
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string }[] }[] }
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] }
}

// ---------- formatos que a API do blog devolve ----------

export type TitleCard = {
  id: number
  type: TmdbType
  title: string
  year: string
  overview: string
  poster: string
  backdrop: string
  rating: number
  /** Página do título na TMDB. */
  tmdbUrl: string
  /** Post publicado do blog sobre este título, se houver. */
  postSlug?: string
  /** Nota que o autor do post deu (0 a 10), se houver. */
  postRating?: number | null
}

const year = (d?: string) => (d ? d.slice(0, 4) : "")
const tmdbUrl = (type: TmdbType, id: number) => `https://www.themoviedb.org/${type}/${id}`

const toCard = (r: RawItem, type: TmdbType): TitleCard => ({
  id: r.id,
  type,
  title: (type === "movie" ? r.title : r.name) ?? r.title ?? r.name ?? "",
  year: year(type === "movie" ? r.release_date : r.first_air_date),
  overview: r.overview ?? "",
  poster: tmdbImage(r.poster_path, "w342"),
  backdrop: tmdbImage(r.backdrop_path, "w780"),
  rating: Math.round((r.vote_average ?? 0) * 10) / 10,
  tmdbUrl: tmdbUrl(type, r.id),
})

/** Marca os títulos que já têm post publicado no blog (o card leva para o post). */
export async function attachPosts<T extends { id: number; type: TmdbType; postSlug?: string; postRating?: number | null }>(cards: T[]): Promise<T[]> {
  if (!cards.length) return cards
  const posts = await prisma.post.findMany({
    where: { status: "published", publishedAt: { lte: new Date() }, tmdbId: { in: cards.map((c) => c.id) } },
    select: { slug: true, tmdbId: true, tmdbType: true, authorRating: true },
  })
  return cards.map((c) => {
    const p = posts.find((x) => x.tmdbId === c.id && x.tmdbType === c.type)
    return { ...c, postSlug: p?.slug, postRating: p?.authorRating ?? null }
  })
}

// ---------- busca ----------

export async function search(q: string, type: TmdbType | "all", page = 1) {
  const path = type === "all" ? "/search/multi" : `/search/${type}`
  const data = await tmdbGet<{ results: RawItem[]; total_results: number }>(path, { query: q, page, include_adult: "false" }, HOUR)
  const items = data.results
    .filter((r) => type !== "all" || r.media_type === "movie" || r.media_type === "tv")
    .map((r) => toCard(r, (type === "all" ? r.media_type : type) as TmdbType))
  return { items: await attachPosts(items), total: data.total_results }
}

// ---------- ficha completa ----------

const pickTrailer = (videos: NonNullable<RawDetails["videos"]>["results"]) => {
  const yt = videos.filter((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"))
  const lang = env.TMDB_LANGUAGE.slice(0, 2)
  const best =
    yt.find((v) => v.iso_639_1 === lang && v.type === "Trailer") ??
    yt.find((v) => v.iso_639_1 === lang) ??
    yt.find((v) => v.type === "Trailer" && v.official) ??
    yt[0]
  return best ? { key: best.key, name: best.name, url: `https://www.youtube.com/watch?v=${best.key}` } : null
}

const providers = (list?: RawProvider[]) => (list ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logo: tmdbImage(p.logo_path, "w92") }))

const images = (list: RawImage[] | undefined, size: string, max: number) =>
  (list ?? [])
    .slice(0, max)
    .map((i) => ({ path: i.file_path, url: tmdbImage(i.file_path, size), width: i.width, height: i.height, lang: i.iso_639_1 }))

export async function details(type: TmdbType, id: number) {
  const append = ["credits", "videos", "images", "watch/providers", "recommendations", "similar", type === "movie" ? "release_dates" : "content_ratings"].join(",")
  const lang = env.TMDB_LANGUAGE.slice(0, 2)
  const d = await tmdbGet<RawDetails>(`/${type}/${id}`, {
    append_to_response: append,
    include_image_language: `${lang},en,null`,
    include_video_language: `${lang},en`,
  })
  const region = env.TMDB_REGION
  const watch = d["watch/providers"]?.results?.[region]
  const certification =
    type === "movie"
      ? d.release_dates?.results.find((r) => r.iso_3166_1 === region)?.release_dates.find((x) => x.certification)?.certification
      : d.content_ratings?.results.find((r) => r.iso_3166_1 === region)?.rating
  const recs = (d.recommendations?.results.length ? d.recommendations.results : d.similar?.results ?? []).slice(0, 12).map((r) => toCard(r, type))

  return {
    ...toCard(d, type),
    originalTitle: (type === "movie" ? d.original_title : d.original_name) ?? "",
    releaseDate: (type === "movie" ? d.release_date : d.first_air_date) ?? "",
    tagline: d.tagline ?? "",
    genres: (d.genres ?? []).map((g) => g.name),
    runtime: type === "movie" ? (d.runtime ?? null) : (d.episode_run_time?.[0] ?? null),
    seasons: d.number_of_seasons ?? null,
    episodes: d.number_of_episodes ?? null,
    status: d.status ?? "",
    certification: certification || "",
    votes: d.vote_count ?? 0,
    posterLarge: tmdbImage(d.poster_path, "w780"),
    backdropLarge: tmdbImage(d.backdrop_path, "w1280"),
    posterPath: d.poster_path ?? null,
    backdropPath: d.backdrop_path ?? null,
    directors: type === "movie" ? (d.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name) : (d.created_by ?? []).map((c) => c.name),
    cast: (d.credits?.cast ?? [])
      .sort((a, b) => a.order - b.order)
      .slice(0, 10)
      .map((c) => ({ name: c.name, character: c.character, photo: tmdbImage(c.profile_path, "w185") })),
    trailer: pickTrailer(d.videos?.results ?? []),
    watch: watch
      ? { link: watch.link ?? "", stream: providers(watch.flatrate), free: providers([...(watch.free ?? []), ...(watch.ads ?? [])]), rent: providers(watch.rent), buy: providers(watch.buy) }
      : null,
    images: { posters: images(d.images?.posters, "w342", 16), backdrops: images(d.images?.backdrops, "w780", 16) },
    recommendations: await attachPosts(recs),
  }
}

// ---------- sugestões do que assistir ----------

export const LISTS = {
  trending: "Em alta na semana",
  popular: "Populares",
  top_rated: "Mais bem avaliados",
  now_playing: "Nos cinemas",
  upcoming: "Em breve nos cinemas",
  on_the_air: "No ar agora",
} as const
export type ListKey = keyof typeof LISTS

export async function suggestions(type: TmdbType, list: ListKey) {
  if (type === "tv" && (list === "now_playing" || list === "upcoming")) throw badRequest("Lista disponível só para filmes")
  if (type === "movie" && list === "on_the_air") throw badRequest("Lista disponível só para séries")
  const path = list === "trending" ? `/trending/${type}/week` : `/${type}/${list}`
  const data = await tmdbGet<{ results: RawItem[] }>(path, { region: env.TMDB_REGION, page: 1 }, 3 * HOUR)
  return attachPosts(data.results.filter((r) => r.poster_path).slice(0, 20).map((r) => toCard(r, type)))
}

// ---------- importar imagem para a biblioteca de mídia ----------

const signature = (b: Buffer) =>
  b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? { mime: "image/jpeg", ext: ".jpg" }
    : b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? { mime: "image/png", ext: ".png" }
    : b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" ? { mime: "image/webp", ext: ".webp" }
    : null

/**
 * Baixa um pôster/backdrop da TMDB e salva na biblioteca de mídia (pasta "Capas"),
 * com texto alternativo e crédito. Se a mesma imagem já foi importada, reaproveita.
 */
export async function importImage(userId: number, type: TmdbType, id: number, imagePath: string, kind: "poster" | "backdrop") {
  const name = `tmdb-${type}-${id}-${kind}-${imagePath.replace(/^\//, "")}`.slice(0, 200)
  const existing = await prisma.media.findFirst({ where: { name } })
  if (existing) return { id: existing.id, url: mediaUrl(existing), alt: existing.alt, reused: true }

  const info = await tmdbGet<RawDetails>(`/${type}/${id}`)
  const title = (type === "movie" ? info.title : info.name) ?? ""
  const { buf } = await downloadTmdbImage(imagePath, kind === "poster" ? "w780" : "w1280")
  const sig = signature(buf)
  if (!sig) throw new HttpError(502, "A TMDB devolveu um arquivo que não é imagem")
  const dims = imageSize(buf)

  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${sig.ext}`
  await fs.writeFile(path.join(UPLOAD_PATH, filename), buf)
  const yr = year(type === "movie" ? info.release_date : info.first_air_date)
  const m = await prisma.media.create({
    data: {
      name,
      filename,
      mimeType: sig.mime,
      type: "image",
      size: buf.length,
      width: dims.width ?? null,
      height: dims.height ?? null,
      alt: `${kind === "poster" ? "Pôster" : "Cena"} de ${title}${yr ? ` (${yr})` : ""}`.slice(0, 300),
      caption: "Imagem: TMDB",
      description: `Importada da TMDB: ${tmdbUrl(type, id)}`,
      folder: "Capas",
      uploaderId: userId,
    },
  })
  return { id: m.id, url: mediaUrl(m), alt: m.alt, reused: false }
}
