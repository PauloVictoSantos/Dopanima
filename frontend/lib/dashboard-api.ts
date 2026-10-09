// Chamadas do painel à API e conversão dos DTOs do backend para os tipos que as
// views já usam (DashPost, Category, MediaItem...). Regras de negócio, slugs,
// notas de SEO e permissões ficam todas no backend.

import { api } from "@/lib/api"
import type { Category, DashPost, DashUser, MediaItem, MediaKind, PostKind, PostStatus, UserRole, UserStatus } from "@/lib/dashboard"

// ---------- rótulos ⇄ códigos da API ----------

const invert = <K extends string, V extends string>(m: Record<K, V>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<V, K>

export const STATUS_LABEL: Record<string, PostStatus> = {
  published: "Publicado", scheduled: "Agendado", review: "Em revisão", draft: "Rascunho", archived: "Arquivado", trash: "Lixeira",
}
export const STATUS_CODE = invert(STATUS_LABEL)

export const KIND_LABEL: Record<string, PostKind> = { filme: "Filme", livro: "Livro", serie: "Série", noticia: "Notícia" }
export const KIND_CATEGORY_SLUG: Record<PostKind, string> = { Filme: "filmes", Livro: "livros", Série: "series", Notícia: "noticias" }

export const ROLE_LABEL: Record<string, UserRole> = {
  super_admin: "Super Admin", editor: "Editor", author: "Autor", reviewer: "Revisor", contributor: "Colaborador", reader: "Leitor",
}
export const ROLE_CODE = invert(ROLE_LABEL)

export const USER_STATUS_LABEL: Record<string, UserStatus> = { active: "Ativo", pending: "Pendente", suspended: "Suspenso" }
export const USER_STATUS_CODE = invert(USER_STATUS_LABEL)

export const MEDIA_LABEL: Record<string, MediaKind> = { image: "Imagem", video: "Vídeo", audio: "Áudio", document: "Documento" }
export const MEDIA_CODE = invert(MEDIA_LABEL)

/** ISO → "YYYY-MM-DD" no fuso do navegador. */
const day = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ---------- DTOs do backend ----------

type Ref = { id: number; name: string; slug: string } | null

export type ApiPost = {
  id: number
  title: string
  slug: string
  subtitle: string
  excerpt: string
  content?: string
  status: string
  featured: boolean
  book: string
  bookAuthor: string
  type: string
  category: Ref
  subcategory: Ref
  author: { id: number; name: string; initials: string; color: string }
  cover: { id: number; url: string; alt: string } | null
  tmdb: { id: number; type: TmdbType } | null
  /** Nota do autor (0 a 10) ou null. */
  authorRating: number | null
  tags: string[]
  publishedAt: string | null
  scheduledAt: string | null
  schedule: { date: string; time: string } | null
  timezone: string
  focusKeyword: string
  metaTitle: string
  metaDescription: string
  canonicalUrl: string
  index: boolean
  follow: boolean
  seoScore: number
  views: number
  commentsCount: number
  engagement: number
  wordCount: number
  readTime: string
  createdAt: string
  updatedAt: string
}

export type ApiCategory = { id: number; name: string; slug: string; description: string; imageUrl: string; color: string; position: number; parentId: number | null; count: number }
export type ApiTag = { id: number; name: string; slug: string; count: number }
export type ApiMedia = {
  id: number; name: string; url: string; type: string; mimeType: string; size: number; sizeLabel: string; width: number | null; height: number | null
  dims: string; alt: string; caption: string; description: string; folder: string; author: string; usedIn: number; createdAt: string; dateLabel: string
}
export type ApiUser = {
  id: number; name: string; email: string; role: string; status: string; city: string; color: string; initials: string; bio: string
  avatarUrl: string; posts: number; comments: number; createdAt: string; joined: string; lastLoginAt: string | null; last: string
}
export type Author = { id: number; name: string; role: string; initials: string; color: string }

// ---------- adaptadores ----------

export const toDashPost = (p: ApiPost): DashPost => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  img: p.cover?.url ?? "",
  cat: KIND_LABEL[p.type] ?? "Notícia",
  author: p.author.name,
  authorId: p.author.id,
  date: p.status === "scheduled" ? (p.schedule?.date ?? "") : day(p.publishedAt),
  views: p.views,
  comments: p.commentsCount,
  eng: p.engagement,
  seo: p.seoScore,
  status: STATUS_LABEL[p.status] ?? "Rascunho",
  tags: p.tags,
  created: day(p.createdAt),
  updated: day(p.updatedAt),
  sched: p.status === "scheduled" ? p.schedule : null,
  html: p.content,
  excerpt: p.excerpt,
  sub: p.subcategory?.name,
})

export const toCategory = (c: ApiCategory): Category => ({
  id: c.id, name: c.name, slug: c.slug, parent: c.parentId ?? 0, desc: c.description, count: c.count, img: c.imageUrl, color: c.color,
})

export const toMediaItem = (m: ApiMedia): MediaItem => ({
  id: m.id, name: m.name, url: m.url, type: MEDIA_LABEL[m.type] ?? "Documento", size: m.sizeLabel, dims: m.dims, date: m.dateLabel,
  author: m.author, folder: m.folder, alt: m.alt, caption: m.caption, desc: m.description, usedIn: m.usedIn,
})

export const toDashUser = (u: ApiUser): DashUser => ({
  id: u.id, name: u.name, email: u.email, role: ROLE_LABEL[u.role] ?? "Leitor", status: USER_STATUS_LABEL[u.status] ?? "Pendente",
  joined: u.joined, last: u.last, comments: u.comments, posts: u.posts, city: u.city || "—", ini: u.initials, color: u.color,
})

// ---------- posts ----------

export type PostPayload = Partial<{
  title: string; slug: string; subtitle: string; excerpt: string; content: string; status: string; featured: boolean
  book: string; bookAuthor: string; categoryId: number | null; subcategoryId: number | null; authorId: number; coverId: number | null
  tmdbId: number | null; tmdbType: TmdbType | null; authorRating: number | null
  tags: string[]; scheduleDate: string; scheduleTime: string; timezone: string; focusKeyword: string; metaTitle: string
  metaDescription: string; canonicalUrl: string; index: boolean; follow: boolean
}>

export type PostList = { items: ApiPost[]; total: number; counts: Record<string, number> }

export const postsApi = {
  list: (q: { status?: string; q?: string; categoryId?: number; authorId?: number; sort?: string; pageSize?: number } = {}) => api.get<PostList>("/api/posts", q),
  get: (id: number) => api.get<ApiPost>(`/api/posts/${id}`),
  create: (data: PostPayload) => api.post<ApiPost>("/api/posts", data),
  update: (id: number, data: PostPayload) => api.patch<ApiPost>(`/api/posts/${id}`, data),
  setStatus: (id: number, status: PostStatus) => api.patch<ApiPost>(`/api/posts/${id}`, { status: STATUS_CODE[status] }),
  duplicate: (id: number) => api.post<ApiPost>(`/api/posts/${id}/duplicate`),
  remove: (id: number) => api.del(`/api/posts/${id}`),
  /** Exclui de vez tudo o que está na lixeira. */
  emptyTrash: () => api.delJson<{ deleted: number }>("/api/posts/trash"),
}

// ---------- taxonomia ----------

export type CategoryPayload = { name: string; slug?: string; description: string; parentId: number | null; imageUrl: string; color?: string }

export const categoriesApi = {
  list: () => api.get<ApiCategory[]>("/api/categories"),
  create: (data: CategoryPayload) => api.post<ApiCategory>("/api/categories", data),
  update: (id: number, data: CategoryPayload) => api.put<ApiCategory>(`/api/categories/${id}`, data),
  move: (id: number, direction: "up" | "down") => api.post<ApiCategory[]>(`/api/categories/${id}/move`, { direction }),
  remove: (id: number) => api.del(`/api/categories/${id}`),
}

export const tagsApi = {
  list: (q = "") => api.get<ApiTag[]>("/api/tags", { q }),
  create: (data: { name: string; slug?: string }) => api.post<ApiTag>("/api/tags", data),
  update: (id: number, data: { name: string; slug?: string }) => api.put<ApiTag>(`/api/tags/${id}`, data),
  remove: (id: number) => api.del(`/api/tags/${id}`),
}

// ---------- mídia ----------

export type MediaPatch = Partial<{ name: string; alt: string; caption: string; description: string; folder: string }>

export const mediaApi = {
  list: (q: { type?: string; folder?: string; q?: string } = {}) => api.get<{ items: ApiMedia[]; total: number; missingAlt: number }>("/api/media", q),
  folders: () => api.get<string[]>("/api/media/folders"),
  upload: (files: File[], folder?: string) => {
    const form = new FormData()
    for (const f of files) form.append("files", f)
    if (folder) form.append("folder", folder)
    return api.upload<ApiMedia[]>("/api/media", form)
  },
  replace: (id: number, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return api.upload<ApiMedia>(`/api/media/${id}/file`, form, "PUT")
  },
  update: (id: number, data: MediaPatch) => api.patch<ApiMedia>(`/api/media/${id}`, data),
  remove: (id: number) => api.del(`/api/media/${id}`),
}

// ---------- usuários ----------

export type UserStats = {
  total: number; activeMonth: number; suspended: number; team: number; newLast30: number
  byRole: Record<string, number>; signups: number[]; signupsFrom: string; signupsTo: string
}

export const usersApi = {
  list: (q: { tab?: string; q?: string; role?: string; sort?: string } = {}) =>
    api.get<{ items: ApiUser[]; counts: Record<string, number> }>("/api/users", q),
  stats: () => api.get<UserStats>("/api/users/stats"),
  authors: () => api.get<Author[]>("/api/users/authors"),
  create: (data: { name: string; email: string; role: string; city?: string; password?: string }) =>
    api.post<{ user: ApiUser; temporaryPassword?: string }>("/api/users", data),
  update: (id: number, data: Partial<{ name: string; email: string; role: string; status: string; city: string; password: string }>) =>
    api.patch<ApiUser>(`/api/users/${id}`, data),
  bulk: (ids: number[], action: "activate" | "suspend" | "delete") => api.post<unknown>("/api/users/bulk", { ids, action }),
  resetPassword: (id: number) => api.post<{ temporaryPassword: string }>(`/api/users/${id}/reset-password`),
  remove: (id: number) => api.del(`/api/users/${id}`),
}

// ---------- SEO ----------

export type SeoStatus = "good" | "warning" | "error"
export type SeoCheck = { id: string; group: string; label: string; status: SeoStatus; message: string; weight: number }
export type SeoReport = {
  score: number
  grade: "good" | "ok" | "poor"
  checks: SeoCheck[]
  stats: {
    words: number; readTimeMinutes: number; sentences: number; paragraphs: number; avgSentenceLength: number; longSentencesPct: number
    transitionPct: number; fleschScore: number; keywordCount: number; keywordDensity: number; headings: number; images: number
    imagesWithoutAlt: number; internalLinks: number; externalLinks: number; brokenLinks: string[]
  }
  preview: { title: string; url: string; description: string }
}
export type SeoHealth = { id: string; level: SeoStatus; label: string; description: string; href?: string }
export type SeoOverview = {
  kpis: { avgScore: number; below65: number; published: number; indexable: number; imagesWithoutAlt: number; distribution: { good: number; ok: number; poor: number } }
  toFix: { id: number; title: string; status: string; score: number; img: string; issue: string }[]
  health: SeoHealth[]
  keywords: { keyword: string; conflict: boolean; posts: { id: number; title: string; score: number; status: string }[] }[]
}
export type SiteSettings = { siteName: string; tagline: string; siteUrl: string; titleTemplate: string; defaultMetaDescription: string; ogImage: string; robots: string }
export type Redirect = { id: number; from: string; to: string; hits: number; createdAt: string }

export type AnalyzePayload = {
  postId?: number; title: string; slug: string; excerpt: string; content: string; focusKeyword: string; metaTitle: string
  metaDescription: string; canonicalUrl: string; index: boolean; coverId: number | null
}

export const seoApi = {
  analyze: (data: AnalyzePayload) => api.post<SeoReport>("/api/seo/analyze", data),
  overview: () => api.get<SeoOverview>("/api/seo/overview"),
  recalculate: () => api.post<{ updated: number }>("/api/seo/recalculate"),
  settings: () => api.get<SiteSettings>("/api/seo/settings"),
  saveSettings: (data: Partial<SiteSettings>) => api.put<SiteSettings>("/api/seo/settings", data),
  robots: () => api.get<{ content: string }>("/api/seo/robots"),
  saveRobots: (content: string) => api.put<{ content: string }>("/api/seo/robots", { content }),
  redirects: () => api.get<Redirect[]>("/api/seo/redirects"),
  addRedirect: (from: string, to: string) => api.post<Redirect>("/api/seo/redirects", { from, to }),
  removeRedirect: (id: number) => api.del(`/api/seo/redirects/${id}`),
}

// ---------- comentários ----------

export type ApiCommentStatus = "pending" | "approved" | "spam" | "trash"
export type ApiComment = {
  id: number; name: string; initials: string; color: string; email: string; content: string; status: ApiCommentStatus
  post: { id: number; title: string; slug: string }; createdAt: string; time: string
  replies: { id: number; who: string; content: string; status: string }[]
}
export type ModerationRules = { blockedWords: string; maxLinks: number; antispam: boolean; requireApproval: boolean; autoApproveReturning: boolean }

export const commentsApi = {
  list: (q: { status?: ApiCommentStatus | "all"; q?: string; postId?: number } = {}) =>
    api.get<{ items: ApiComment[]; counts: Record<string, number> }>("/api/comments", q),
  setStatus: (id: number, status: ApiCommentStatus) => api.patch<unknown>(`/api/comments/${id}`, { status }),
  reply: (id: number, content: string) => api.post<ApiComment>(`/api/comments/${id}/reply`, { content }),
  bulk: (ids: number[], action: "approve" | "pending" | "spam" | "trash" | "delete") => api.post<unknown>("/api/comments/bulk", { ids, action }),
  remove: (id: number) => api.del(`/api/comments/${id}`),
  settings: () => api.get<ModerationRules>("/api/comments/settings"),
  saveSettings: (data: ModerationRules) => api.put<ModerationRules>("/api/comments/settings", data),
}

// ---------- visão geral ----------

export type Overview = {
  days: number
  views: { period: number; previous: number; change: number; allTime: number; series: { day: string; views: number }[] }
  sources: { source: string; views: number }[]
  posts: { total: number; byStatus: Record<string, number> }
  comments: Record<"pending" | "approved" | "spam" | "trash", number> & { pendingList: { id: number; name: string; post: string; content: string; time: string }[] }
  users: { total: number; newInPeriod: number; change: number }
  topPosts: { id: number; title: string; slug: string; type: string; author: string; img: string; periodViews: number; views: number; comments: number; seo: number; publishedAt: string | null }[]
  activity: { who: string; color: string; what: string; when: string }[]
  alerts: { level: SeoStatus; title: string; description: string; href?: string }[]
}

export const statsApi = {
  overview: (days: 7 | 30 | 90) => api.get<Overview>("/api/stats/overview", { days }),
}

// ---------- perfil ----------

export const profileApi = {
  update: (data: Partial<{ name: string; email: string; city: string; bio: string; avatarUrl: string; currentPassword: string; newPassword: string }>) =>
    api.patch<import("@/lib/session").Me>("/api/auth/me", data),
}

// ---------- TMDB ----------

export type TmdbType = "movie" | "tv"
export type TmdbCard = {
  id: number; type: TmdbType; title: string; year: string; overview: string; poster: string; backdrop: string
  rating: number; tmdbUrl: string; postSlug?: string
  /** Nota que o autor do post deu, se o título tem resenha no blog. */
  postRating?: number | null
}
export type TmdbImage = { path: string; url: string; width: number; height: number; lang: string | null }
export type TmdbDetails = TmdbCard & {
  originalTitle: string; releaseDate: string; tagline: string; genres: string[]; runtime: number | null; seasons: number | null
  episodes: number | null; status: string; certification: string; votes: number; posterLarge: string; backdropLarge: string
  posterPath: string | null; backdropPath: string | null; directors: string[]
  cast: { name: string; character: string; photo: string }[]
  trailer: { key: string; name: string; url: string } | null
  watch: { link: string; stream: TmdbProvider[]; free: TmdbProvider[]; rent: TmdbProvider[]; buy: TmdbProvider[] } | null
  images: { posters: TmdbImage[]; backdrops: TmdbImage[] }
  recommendations: TmdbCard[]
}
export type TmdbProvider = { id: number; name: string; logo: string }

export const tmdbApi = {
  status: () => api.get<{ enabled: boolean; language: string; region: string }>("/api/tmdb/status"),
  search: (q: string, type: TmdbType | "all" = "all") => api.get<{ items: TmdbCard[]; total: number }>("/api/tmdb/search", { q, type }),
  details: (type: TmdbType, id: number) => api.get<TmdbDetails>(`/api/tmdb/${type}/${id}`),
  /** Baixa a imagem para a biblioteca de mídia e devolve o arquivo criado (ou o já existente). */
  importImage: (type: TmdbType, id: number, path: string, kind: "poster" | "backdrop") =>
    api.post<{ id: number; url: string; alt: string; reused: boolean }>(`/api/tmdb/${type}/${id}/import`, { path, kind }),
}
