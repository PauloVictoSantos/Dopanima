import type { Prisma } from "@prisma/client"
import { CATEGORY_TYPE } from "../../lib/constants"
import { dateLabel, initials, utcToZoned } from "../../lib/format"
import { readTime, wordCount } from "../../lib/html"
import { mediaUrl } from "../../lib/media-url"

export const postInclude = {
  category: true,
  subcategory: true,
  author: { select: { id: true, name: true, color: true, avatarUrl: true } },
  cover: true,
  tags: { include: { tag: true } },
} satisfies Prisma.PostInclude

export type PostWithRelations = Prisma.PostGetPayload<{ include: typeof postInclude }>

export const postType = (p: Pick<PostWithRelations, "category">) => CATEGORY_TYPE[p.category?.slug ?? ""] ?? "noticia"

const PALETTES: [string, string][] = [
  ["#5A0F6E", "#FF5A36"], ["#B5179E", "#F7E27A"], ["#2A0A12", "#FF5A36"], ["#5A0F6E", "#C9A0E0"],
  ["#3B0A45", "#B5179E"], ["#7A1F3D", "#F7E27A"], ["#26113A", "#8BE04E"], ["#B5179E", "#5A0F6E"],
]

const authorDto = (a: PostWithRelations["author"]) => ({ id: a.id, name: a.name, initials: initials(a.name), color: a.color, avatarUrl: a.avatarUrl })
const catDto = (c: PostWithRelations["category"]) => (c ? { id: c.id, name: c.name, slug: c.slug } : null)

/** Post completo para o painel. */
export function toAdminPost(p: PostWithRelations, opts: { content?: boolean } = {}) {
  let seoChecks: unknown = undefined
  if (opts.content) {
    try {
      seoChecks = JSON.parse(p.seoReport)
    } catch {
      seoChecks = []
    }
  }
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    subtitle: p.subtitle,
    excerpt: p.excerpt,
    ...(opts.content ? { content: p.content, seoChecks } : {}),
    status: p.status,
    featured: p.featured,
    book: p.book,
    bookAuthor: p.bookAuthor,
    type: postType(p),
    category: catDto(p.category),
    subcategory: catDto(p.subcategory),
    author: authorDto(p.author),
    cover: p.cover ? { id: p.cover.id, url: mediaUrl(p.cover), alt: p.cover.alt } : null,
    tmdb: p.tmdbId && p.tmdbType ? { id: p.tmdbId, type: p.tmdbType } : null,
    authorRating: p.authorRating,
    tags: p.tags.map((t) => t.tag.name),
    publishedAt: p.publishedAt,
    scheduledAt: p.scheduledAt,
    schedule: p.scheduledAt ? utcToZoned(p.scheduledAt, p.timezone) : null,
    timezone: p.timezone,
    focusKeyword: p.focusKeyword,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    canonicalUrl: p.canonicalUrl,
    index: p.index,
    follow: p.follow,
    seoScore: p.seoScore,
    views: p.views,
    commentsCount: p.commentsCount,
    engagement: p.engagement,
    wordCount: wordCount(p.content),
    readTime: readTime(p.content),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

/** Post como o site público consome (cards, home e página do post). */
export function toPublicPost(p: PostWithRelations) {
  const img = p.cover ? mediaUrl(p.cover) : ""
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    excerpt: p.excerpt,
    type: postType(p),
    category: catDto(p.category),
    sub: p.subcategory?.name ?? "",
    subSlug: p.subcategory?.slug ?? "",
    book: p.book || undefined,
    bookAuthor: p.bookAuthor || undefined,
    author: authorDto(p.author),
    publishedAt: p.publishedAt,
    ts: p.publishedAt?.getTime() ?? 0,
    dateLabel: dateLabel(p.publishedAt),
    readTime: readTime(p.content),
    palette: PALETTES[p.id % PALETTES.length],
    img,
    imgAlt: p.cover?.alt ?? "",
    real: !!img,
    tags: p.tags.map((t) => ({ name: t.tag.name, slug: t.tag.slug })),
    views: p.views,
    tmdb: p.tmdbId && p.tmdbType ? { id: p.tmdbId, type: p.tmdbType } : null,
    /** Nota do autor (0 a 10) ou null. */
    authorRating: p.authorRating,
  }
}
