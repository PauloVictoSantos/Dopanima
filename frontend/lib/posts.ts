// Tipos e helpers de apresentação dos posts públicos. Os dados vêm da API
// (lib/public-api.ts no servidor; searchPosts no navegador).

import { API_URL } from "@/lib/api"

export type PostType = "filme" | "livro" | "serie" | "noticia"

export type Author = { name: string; initials: string; color: string }

export type Post = {
  id: number
  slug: string
  title: string
  subtitle: string
  type: PostType
  /** Subcategory name: Resenhas, Listas, Bastidores... — or the news section. */
  sub: string
  subSlug: string
  book?: string
  bookAuthor?: string
  author: Author
  ts: number
  dateLabel: string
  readTime: string
  palette: [string, string]
  img: string
  imgAlt: string
  /** True when the post has a featured image; books without one get a typographic cover. */
  real: boolean
  excerpt: string
  tags: { name: string; slug: string }[]
  /** Filme/série vinculado na TMDB. */
  tmdb: { id: number; type: "movie" | "tv" } | null
  /** Nota do autor da resenha (0 a 10) ou null. */
  authorRating: number | null
}

export type PostSeo = {
  title: string
  description: string
  canonical: string
  index: boolean
  follow: boolean
  image: string
  imageAlt: string
  keywords: string[]
  publishedTime: string | null
  modifiedTime: string
  section: string
}

export type FullPost = Post & { contentHtml: string; seo: PostSeo }

export type HomeData = {
  hero: Post[]
  filmFeatures: Post[]
  bookFeatures: Post[]
  picks: { film: Post | null; book: Post | null }
  posts: Post[]
}

export const TYPE_META: Record<PostType, { label: string; color: string }> = {
  filme: { label: "Filme", color: "#FF5A36" },
  livro: { label: "Livro", color: "#F7E27A" },
  serie: { label: "Série", color: "#8BE04E" },
  noticia: { label: "Notícia", color: "#C9A0E0" },
}

export const FILTERS = ["Tudo", "Filmes", "Livros", "Séries", "Notícias", "Resenhas", "Listas", "Bastidores"] as const
export type Filter = (typeof FILTERS)[number]

export const FILTER_FN: Record<Filter, (p: Post) => boolean> = {
  Tudo: () => true,
  Filmes: (p) => p.type === "filme",
  Livros: (p) => p.type === "livro",
  Séries: (p) => p.type === "serie",
  Notícias: (p) => p.type === "noticia",
  Resenhas: (p) => p.subSlug === "resenhas",
  Listas: (p) => p.subSlug === "listas",
  Bastidores: (p) => p.subSlug === "bastidores",
}

/** CSS background for a cover: the image over a palette gradient fallback. */
export const coverBg = (p: Post) =>
  p.img
    ? `url("${p.img}") center/cover no-repeat, linear-gradient(135deg, ${p.palette[0]} 0%, #1A0522 100%)`
    : `linear-gradient(135deg, ${p.palette[0]} 0%, ${p.palette[1]} 60%, #1A0522 100%)`

/** Books without a real cover get a typographic gradient cover instead. */
export const bookBg = (p: Post) =>
  p.real
    ? `url("${p.img}") center/cover no-repeat, ${p.palette[0]}`
    : `linear-gradient(160deg, ${p.palette[1]} 0%, ${p.palette[0]} 70%)`

/** Busca no navegador (header do site). */
export async function searchPosts(q: string, signal?: AbortSignal): Promise<Post[]> {
  const res = await fetch(`${API_URL}/api/public/posts?limit=60&q=${encodeURIComponent(q)}`, { signal })
  if (!res.ok) throw new Error("Falha na busca")
  return (await res.json()).items
}

/** Conta a visualização do post. O referrer diz de onde a pessoa veio (busca, rede social...). */
export function trackView(slug: string) {
  fetch(`${API_URL}/api/public/posts/${encodeURIComponent(slug)}/view`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referrer: document.referrer }),
  }).catch(() => {})
}
