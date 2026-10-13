import "server-only"
import type { PostBook } from "@/components/post/book-info"
import type { PostTmdb } from "@/components/post/tmdb-info"
import type { FullPost, HomeData, Post } from "@/lib/posts"


const BASE = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333").replace(/\/$/, "")

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API respondeu ${res.status} em ${path}`)
  return res.json() as Promise<T>
}

export const getHome = async () => (await get<HomeData>("/api/public/home"))!

export const getPostPage = (slug: string) => get<{ post: FullPost; related: Post[] }>(`/api/public/posts/${encodeURIComponent(slug)}`)

export const getSiteSettings = () =>
  get<{ siteName: string; tagline: string; siteUrl: string; titleTemplate: string; defaultMetaDescription: string; ogImage: string }>("/api/public/settings")

/** Destino de um redirecionamento 301 cadastrado no painel, se houver. */
export async function resolveRedirect(path: string) {
  const r = await get<{ to: string }>(`/api/public/redirects/resolve?path=${encodeURIComponent(path)}`).catch(() => null)
  return r?.to ?? null
}

/** Ficha da TMDB do título ligado ao post (vazia se não houver vínculo ou chave). */
export async function getPostTmdb(slug: string) {
  const r = await get<{ enabled: boolean } & PostTmdb>(`/api/public/posts/${encodeURIComponent(slug)}/tmdb`).catch(() => null)
  return r?.enabled ? r : null
}

/** Ficha do Google Books do livro ligado ao post (vazia se não houver vínculo). */
export async function getPostBook(slug: string) {
  const r = await get<{ enabled: boolean } & PostBook>(`/api/public/posts/${encodeURIComponent(slug)}/book`).catch(() => null)
  return r?.enabled ? r : null
}
