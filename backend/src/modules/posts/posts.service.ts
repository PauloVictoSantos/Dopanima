import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { POST_STATUSES, can, type PostStatus } from "../../lib/constants"
import { zonedToUtc } from "../../lib/format"
import { sanitize } from "../../lib/html"
import { badRequest, forbidden, notFound } from "../../lib/http-error"
import { prisma } from "../../lib/prisma"
import { slugify, uniquePostSlug } from "../../lib/slug"
import { redirectSlugChange, refreshPostSeo } from "../seo/seo.service"
import { postInclude, toAdminPost } from "./posts.mapper"

type Actor = NonNullable<Express.Request["user"]>

const validTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// Sem .default() aqui: o mesmo schema valida PATCH parciais, e os padrões
// entram só na criação (withDefaults).
export const postPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Dê um título ao post").max(200),
    slug: z.string().trim().max(120),
    subtitle: z.string().trim().max(300),
    excerpt: z.string().trim().max(500),
    content: z.string().max(500_000),
    status: z.enum(POST_STATUSES),
    featured: z.boolean(),
    book: z.string().trim().max(200),
    bookAuthor: z.string().trim().max(200),
    categoryId: z.number().int().positive().nullable(),
    subcategoryId: z.number().int().positive().nullable(),
    authorId: z.number().int().positive(),
    coverId: z.number().int().positive().nullable(),
    tmdbId: z.number().int().positive().nullable(),
    tmdbType: z.enum(["movie", "tv"]).nullable(),
    /** Nota do autor, 0 a 10 em passos de 0,5. */
    authorRating: z.number().min(0, "A nota vai de 0 a 10").max(10, "A nota vai de 0 a 10").multipleOf(0.5, "Use passos de 0,5").nullable(),
    tags: z.array(z.string().trim().min(1).max(50)).max(30),
    scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    scheduleTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
    timezone: z.string().refine(validTz, "Fuso horário inválido"),
    focusKeyword: z.string().trim().max(100),
    metaTitle: z.string().trim().max(120),
    metaDescription: z.string().trim().max(320),
    canonicalUrl: z.string().trim().max(500),
    index: z.boolean(),
    follow: z.boolean(),
  })
  .partial()
export const postCreateSchema = postPatchSchema.required({ title: true })
export type PostPatch = z.infer<typeof postPatchSchema>

const DEFAULTS = {
  slug: "", subtitle: "", excerpt: "", content: "", status: "draft" as PostStatus, featured: false, book: "", bookAuthor: "",
  categoryId: null as number | null, subcategoryId: null as number | null, coverId: null as number | null, tags: [] as string[],
  tmdbId: null as number | null, tmdbType: null as "movie" | "tv" | null, authorRating: null as number | null,
  timezone: "America/Manaus", focusKeyword: "", metaTitle: "", metaDescription: "", canonicalUrl: "", index: true, follow: true,
}
export type PostInput = typeof DEFAULTS & Pick<PostPatch, "authorId" | "scheduleDate" | "scheduleTime"> & { title: string }

const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
const withDefaults = (p: PostPatch & { title: string }): PostInput => ({ ...DEFAULTS, ...defined(p), title: p.title })

export const listQuerySchema = z.object({
  status: z.enum([...POST_STATUSES, "all"]).default("all"),
  q: z.string().trim().default(""),
  categoryId: z.coerce.number().int().optional(),
  authorId: z.coerce.number().int().optional(),
  sort: z.enum(["recent", "views", "seo", "title"]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
})

// ---------- permissões ----------

const canEdit = (actor: Actor, authorId: number) => can(actor.role, "editAll") || (can(actor.role, "editOwn") && authorId === actor.id)

function assertStatusAllowed(actor: Actor, status: PostStatus) {
  if (status === "published" && !can(actor.role, "publish")) throw forbidden("Sua função não pode publicar. Envie para revisão.")
  if (status === "scheduled" && !can(actor.role, "schedule")) throw forbidden("Sua função não pode agendar posts.")
}

// ---------- helpers ----------

async function validateCategories(categoryId: number | null, subcategoryId: number | null) {
  if (categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } })
    if (!cat) throw badRequest("Categoria não encontrada")
    if (cat.parentId) throw badRequest("Escolha uma categoria principal; a filha vai em subcategoria")
  }
  if (subcategoryId) {
    const sub = await prisma.category.findUnique({ where: { id: subcategoryId } })
    if (!sub || sub.parentId !== categoryId) throw badRequest("A subcategoria não pertence à categoria escolhida")
  }
}

async function tagConnections(names: string[]) {
  const unique = [...new Map(names.map((n) => n.replace(/^#/, "").trim().toLowerCase()).filter(Boolean).map((n) => [slugify(n), n])).entries()]
  const tags = await Promise.all(
    unique.map(([slug, name]) => prisma.tag.upsert({ where: { slug }, create: { name, slug }, update: {} }))
  )
  return tags.map((t) => ({ tagId: t.id }))
}

/** Datas de publicação/agendamento conforme o status escolhido. */
function scheduling(input: Pick<PostInput, "status" | "scheduleDate" | "scheduleTime" | "timezone">, current?: { publishedAt: Date | null }) {
  if (input.status === "scheduled") {
    if (!input.scheduleDate) throw badRequest("Escolha a data do agendamento")
    const at = zonedToUtc(input.scheduleDate, input.scheduleTime ?? "09:00", input.timezone)
    if (at.getTime() <= Date.now()) throw badRequest("Escolha uma data e hora no futuro para agendar")
    return { scheduledAt: at, publishedAt: null }
  }
  if (input.status === "published") return { scheduledAt: null, publishedAt: current?.publishedAt ?? new Date() }
  return { scheduledAt: null, publishedAt: current?.publishedAt ?? null }
}

async function load(id: number) {
  const post = await prisma.post.findUnique({ where: { id }, include: postInclude })
  if (!post) throw notFound("Post não encontrado")
  return post
}

// ---------- CRUD ----------

/** Sem "editAll", só aparecem os próprios posts e os já publicados. */
const visibleTo = (actor: Actor): Prisma.PostWhereInput =>
  can(actor.role, "editAll") ? {} : { OR: [{ authorId: actor.id }, { status: "published" }] }

export async function listPosts(actor: Actor, query: z.infer<typeof listQuerySchema>) {
  const base: Prisma.PostWhereInput = {
    AND: [visibleTo(actor)],
    ...(query.categoryId ? { OR: [{ categoryId: query.categoryId }, { subcategoryId: query.categoryId }] } : {}),
    ...(query.authorId ? { authorId: query.authorId } : {}),
    ...(query.q
      ? {
          AND: [visibleTo(actor), {
            OR: [
              { title: { contains: query.q } },
              { excerpt: { contains: query.q } },
              { content: { contains: query.q } },
              { author: { name: { contains: query.q } } },
              { category: { name: { contains: query.q } } },
              { tags: { some: { tag: { name: { contains: query.q.toLowerCase() } } } } },
            ],
          }],
        }
      : {}),
  }
  const where: Prisma.PostWhereInput = { ...base, status: query.status === "all" ? { not: "trash" } : query.status }
  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    query.sort === "views" ? [{ views: "desc" }]
      : query.sort === "seo" ? [{ seoScore: "desc" }]
      : query.sort === "title" ? [{ title: "asc" }]
      : [{ updatedAt: "desc" }]

  const [items, total, grouped] = await Promise.all([
    prisma.post.findMany({ where, include: postInclude, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.post.count({ where }),
    prisma.post.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ])
  const counts: Record<string, number> = Object.fromEntries(POST_STATUSES.map((s) => [s, 0]))
  for (const g of grouped) counts[g.status] = g._count._all
  counts.all = POST_STATUSES.filter((s) => s !== "trash").reduce((a, s) => a + counts[s], 0)

  return { items: items.map((p) => toAdminPost(p)), total, page: query.page, pageSize: query.pageSize, counts }
}

export async function getPost(id: number, actor?: Actor) {
  const post = await load(id)
  if (actor && !can(actor.role, "editAll") && post.authorId !== actor.id && post.status !== "published")
    throw forbidden("Você não tem acesso a este post")
  return toAdminPost(post, { content: true })
}

export async function createPost(actor: Actor, body: z.infer<typeof postCreateSchema>) {
  if (!can(actor.role, "create")) throw forbidden("Sua função não pode criar posts")
  const input = withDefaults(body)
  assertStatusAllowed(actor, input.status)
  const authorId = input.authorId && input.authorId !== actor.id && can(actor.role, "editAll") ? input.authorId : actor.id
  await validateCategories(input.categoryId, input.subcategoryId)

  const post = await prisma.post.create({
    data: {
      title: input.title,
      slug: await uniquePostSlug(input.slug || input.title),
      subtitle: input.subtitle,
      excerpt: input.excerpt,
      content: sanitize(input.content),
      seoReport: "[]",
      status: input.status,
      featured: input.featured,
      book: input.book,
      bookAuthor: input.bookAuthor,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      coverId: input.coverId,
      tmdbId: input.tmdbId && input.tmdbType ? input.tmdbId : null,
      tmdbType: input.tmdbId && input.tmdbType ? input.tmdbType : null,
      authorRating: input.authorRating,
      authorId,
      timezone: input.timezone,
      focusKeyword: input.focusKeyword,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      canonicalUrl: input.canonicalUrl,
      index: input.index,
      follow: input.follow,
      ...scheduling(input),
      tags: { create: await tagConnections(input.tags) },
    },
  })
  await refreshPostSeo(post.id)
  return getPost(post.id)
}

export async function updatePost(actor: Actor, id: number, patch: PostPatch) {
  const current = await load(id)
  if (!canEdit(actor, current.authorId)) throw forbidden("Você só pode editar os próprios posts")

  const input = withDefaults({
    title: current.title,
    slug: current.slug,
    subtitle: current.subtitle,
    excerpt: current.excerpt,
    content: current.content,
    status: current.status as PostStatus,
    featured: current.featured,
    book: current.book,
    bookAuthor: current.bookAuthor,
    categoryId: current.categoryId,
    subcategoryId: current.subcategoryId,
    coverId: current.coverId,
    tmdbId: current.tmdbId,
    tmdbType: (current.tmdbType as "movie" | "tv" | null) ?? null,
    authorRating: current.authorRating,
    tags: current.tags.map((t) => t.tag.name),
    timezone: current.timezone,
    focusKeyword: current.focusKeyword,
    metaTitle: current.metaTitle,
    metaDescription: current.metaDescription,
    canonicalUrl: current.canonicalUrl,
    index: current.index,
    follow: current.follow,
    ...defined(patch),
  })
  if (input.status !== current.status) assertStatusAllowed(actor, input.status)
  // Mudar a data de um agendado também exige permissão de agendar.
  if (input.status === "scheduled" && (patch.scheduleDate || patch.scheduleTime)) assertStatusAllowed(actor, "scheduled")
  const keepSchedule = input.status === "scheduled" && current.status === "scheduled" && !patch.scheduleDate && !patch.scheduleTime
  await validateCategories(input.categoryId, input.subcategoryId)

  const authorId = input.authorId && input.authorId !== current.authorId ? (can(actor.role, "editAll") ? input.authorId : current.authorId) : current.authorId
  const slug = patch.slug !== undefined || patch.title !== undefined ? await uniquePostSlug(input.slug || input.title, id) : current.slug

  await prisma.$transaction([
    prisma.postTag.deleteMany({ where: { postId: id } }),
    prisma.post.update({
      where: { id },
      data: {
        title: input.title,
        slug,
        subtitle: input.subtitle,
        excerpt: input.excerpt,
        content: patch.content !== undefined ? sanitize(input.content) : current.content,
        status: input.status,
        featured: input.featured,
        book: input.book,
        bookAuthor: input.bookAuthor,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        coverId: input.coverId,
        tmdbId: input.tmdbId && input.tmdbType ? input.tmdbId : null,
        tmdbType: input.tmdbId && input.tmdbType ? input.tmdbType : null,
        authorRating: input.authorRating,
        authorId,
        timezone: input.timezone,
        focusKeyword: input.focusKeyword,
        metaTitle: input.metaTitle,
        metaDescription: input.metaDescription,
        canonicalUrl: input.canonicalUrl,
        index: input.index,
        follow: input.follow,
        ...(keepSchedule ? {} : scheduling(input, current)),
        // Data de entrada na lixeira (a limpeza automática apaga após TRASH_DAYS).
        trashedAt: input.status === "trash" ? (current.trashedAt ?? new Date()) : null,
        tags: { create: await tagConnections(input.tags) },
      },
    }),
  ])
  if (slug !== current.slug && current.status === "published") await redirectSlugChange(current.slug, slug)
  await refreshPostSeo(id)
  return getPost(id)
}

export async function duplicatePost(actor: Actor, id: number) {
  const src = await load(id)
  if (!can(actor.role, "create")) throw forbidden()
  if (!can(actor.role, "editAll") && src.authorId !== actor.id && src.status !== "published") throw forbidden("Você não tem acesso a este post")
  const copy = await prisma.post.create({
    data: {
      title: `${src.title} (cópia)`,
      slug: await uniquePostSlug(`${src.slug}-copia`),
      subtitle: src.subtitle,
      excerpt: src.excerpt,
      content: src.content,
      seoReport: "[]",
      status: "draft",
      book: src.book,
      bookAuthor: src.bookAuthor,
      categoryId: src.categoryId,
      subcategoryId: src.subcategoryId,
      coverId: src.coverId,
      tmdbId: src.tmdbId,
      tmdbType: src.tmdbType,
      authorRating: src.authorRating,
      authorId: actor.id,
      timezone: src.timezone,
      focusKeyword: src.focusKeyword,
      metaTitle: src.metaTitle,
      metaDescription: src.metaDescription,
      index: src.index,
      follow: src.follow,
      tags: { create: src.tags.map((t) => ({ tagId: t.tagId })) },
    },
  })
  await refreshPostSeo(copy.id)
  return getPost(copy.id)
}

export async function deletePost(actor: Actor, id: number) {
  const post = await load(id)
  if (!can(actor.role, "delete") && !(canEdit(actor, post.authorId) && post.status === "draft")) throw forbidden("Sua função não pode excluir posts")
  await prisma.$transaction([
    prisma.redirect.deleteMany({ where: { to: `/post/${post.slug}` } }),
    prisma.post.delete({ where: { id } }),
  ])
}

/** Apaga de vez tudo o que está na lixeira. */
export async function emptyTrash(actor: Actor) {
  if (!can(actor.role, "delete")) throw forbidden("Sua função não pode excluir posts")
  const posts = await prisma.post.findMany({ where: { status: "trash" }, select: { id: true, slug: true } })
  await prisma.$transaction([
    prisma.redirect.deleteMany({ where: { to: { in: posts.map((p) => `/post/${p.slug}`) } } }),
    prisma.post.deleteMany({ where: { id: { in: posts.map((p) => p.id) } } }),
  ])
  return { deleted: posts.length }
}

export const TRASH_DAYS = 30

/** Apaga posts que estão na lixeira há mais de TRASH_DAYS dias. Chamado pelo agendador. */
export async function purgeOldTrash(now = new Date()) {
  const limit = new Date(now.getTime() - TRASH_DAYS * 86_400_000)
  const old = await prisma.post.findMany({ where: { status: "trash", trashedAt: { lte: limit } }, select: { id: true, slug: true } })
  if (!old.length) return 0
  await prisma.$transaction([
    prisma.redirect.deleteMany({ where: { to: { in: old.map((p) => `/post/${p.slug}`) } } }),
    prisma.post.deleteMany({ where: { id: { in: old.map((p) => p.id) } } }),
  ])
  return old.length
}

/** Publica posts agendados cujo horário já chegou. Chamado pelo agendador. */
export async function publishDuePosts(now = new Date()) {
  const due = await prisma.post.findMany({ where: { status: "scheduled", scheduledAt: { lte: now } }, select: { id: true, scheduledAt: true } })
  for (const p of due) {
    await prisma.post.update({ where: { id: p.id }, data: { status: "published", publishedAt: p.scheduledAt, scheduledAt: null } })
  }
  return due.length
}
