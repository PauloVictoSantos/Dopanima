import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { initials, relativeTime } from "../../lib/format"
import { badRequest, notFound } from "../../lib/http-error"
import { prisma } from "../../lib/prisma"

export const COMMENT_STATUSES = ["pending", "approved", "spam", "trash"] as const
export type CommentStatus = (typeof COMMENT_STATUSES)[number]

// ---------- regras de moderação (guardadas em Setting) ----------

export const moderationSchema = z.object({
  /** Palavras/expressões separadas por vírgula; comentário que contém alguma vai para spam. */
  blockedWords: z.string().max(2000),
  /** Mais links que isso = spam. */
  maxLinks: z.number().int().min(0).max(10),
  /** Filtro anti-spam (links, palavras bloqueadas, padrões suspeitos). */
  antispam: z.boolean(),
  /** Comentários novos ficam pendentes até alguém aprovar. */
  requireApproval: z.boolean(),
  /** Quem já teve comentário aprovado (mesma conta) é aprovado direto. */
  autoApproveReturning: z.boolean(),
})
export type Moderation = z.infer<typeof moderationSchema>

const DEFAULT_MODERATION: Moderation = {
  blockedWords: "grátis, promoção, clique aqui, ganhe dinheiro",
  maxLinks: 2,
  antispam: true,
  requireApproval: true,
  autoApproveReturning: true,
}

export async function getModeration(): Promise<Moderation> {
  const row = await prisma.setting.findUnique({ where: { key: "moderation" } })
  return { ...DEFAULT_MODERATION, ...(row ? JSON.parse(row.value) : {}) }
}

export async function saveModeration(data: Moderation) {
  const value = JSON.stringify(moderationSchema.parse(data))
  await prisma.setting.upsert({ where: { key: "moderation" }, create: { key: "moderation", value }, update: { value } })
  return getModeration()
}

// ---------- helpers ----------

const COLORS = ["#5A0F6E", "#B5179E", "#7A2E8E", "#3B0A45", "#7A1F3D", "#26113A"]
const colorFor = (s: string) => COLORS[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Decide o status de um comentário novo de leitor. */
export async function classify(input: { content: string; name: string; userId: number }, rules: Moderation): Promise<CommentStatus> {
  if (rules.antispam) {
    const text = fold(`${input.name} ${input.content}`)
    const links = (input.content.match(/https?:\/\/|www\./gi) ?? []).length
    const blocked = rules.blockedWords.split(",").map((w) => fold(w.trim())).filter(Boolean)
    if (links > rules.maxLinks) return "spam"
    if (blocked.some((w) => text.includes(w))) return "spam"
    if (/(.)\1{9,}/.test(input.content)) return "spam" // "kkkkkkkkkkkk", "!!!!!!!!!!!"
    if (input.content.length > 30 && input.content === input.content.toUpperCase() && /[A-Z]/.test(input.content)) return "spam"
  }
  if (!rules.requireApproval) return "approved"
  if (rules.autoApproveReturning && (await prisma.comment.count({ where: { userId: input.userId, status: "approved" } }))) return "approved"
  return "pending"
}

/** Mantém Post.commentsCount = comentários aprovados. */
export async function refreshCounts(postIds: number[]) {
  for (const id of new Set(postIds)) {
    const n = await prisma.comment.count({ where: { postId: id, status: "approved" } })
    await prisma.post.update({ where: { id }, data: { commentsCount: n } }).catch(() => {})
  }
}

// ---------- painel ----------

export const listSchema = z.object({
  status: z.enum([...COMMENT_STATUSES, "all"]).default("pending"),
  q: z.string().trim().max(100).default(""),
  postId: z.coerce.number().int().positive().optional(),
})

const adminInclude = {
  post: { select: { id: true, title: true, slug: true } },
  user: { select: { role: true } },
  replies: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
} satisfies Prisma.CommentInclude

type AdminRow = Prisma.CommentGetPayload<{ include: typeof adminInclude }>

const toAdmin = (c: AdminRow) => ({
  id: c.id,
  name: c.authorName,
  initials: initials(c.authorName),
  color: colorFor(c.authorEmail),
  email: c.authorEmail,
  content: c.content,
  status: c.status,
  /** Comentário de alguém da equipe (não passa pela moderação). */
  staff: !!c.user && c.user.role !== "reader",
  post: c.post,
  createdAt: c.createdAt,
  time: relativeTime(c.createdAt),
  replies: c.replies.map((r) => ({ id: r.id, who: r.user?.name ?? r.authorName, content: r.content, status: r.status })),
})

export async function listComments(q: z.infer<typeof listSchema>) {
  // Respostas da equipe aparecem dentro do comentário original, não como itens soltos.
  const base: Prisma.CommentWhereInput = {
    parentId: null,
    ...(q.postId ? { postId: q.postId } : {}),
    ...(q.q ? { OR: [{ content: { contains: q.q } }, { authorName: { contains: q.q } }, { authorEmail: { contains: q.q } }] } : {}),
  }
  const [items, grouped] = await Promise.all([
    prisma.comment.findMany({
      where: { ...base, status: q.status === "all" ? { not: "trash" } : q.status },
      include: adminInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.comment.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ])
  const counts: Record<string, number> = Object.fromEntries(COMMENT_STATUSES.map((s) => [s, 0]))
  for (const g of grouped) counts[g.status] = g._count._all
  counts.all = counts.pending + counts.approved + counts.spam
  return { items: items.map(toAdmin), counts }
}

export async function setStatus(ids: number[], status: CommentStatus) {
  const rows = await prisma.comment.findMany({ where: { id: { in: ids } }, select: { postId: true } })
  if (!rows.length) throw notFound("Comentário não encontrado")
  await prisma.comment.updateMany({ where: { id: { in: ids } }, data: { status } })
  await refreshCounts(rows.map((r) => r.postId))
  return { updated: rows.length }
}

export async function removeComments(ids: number[]) {
  const rows = await prisma.comment.findMany({ where: { id: { in: ids } }, select: { postId: true } })
  if (!rows.length) throw notFound("Comentário não encontrado")
  await prisma.comment.deleteMany({ where: { id: { in: ids } } })
  await refreshCounts(rows.map((r) => r.postId))
  return { deleted: rows.length }
}

/** Resposta da equipe: publicada na hora e aprova o comentário original. */
export async function reply(user: { id: number; name: string; email: string }, id: number, content: string) {
  const parent = await prisma.comment.findUnique({ where: { id } })
  if (!parent) throw notFound("Comentário não encontrado")
  if (parent.parentId) throw badRequest("Responda ao comentário original")
  await prisma.$transaction([
    prisma.comment.create({
      data: { postId: parent.postId, parentId: id, userId: user.id, authorName: user.name, authorEmail: user.email, content, status: "approved" },
    }),
    prisma.comment.update({ where: { id }, data: { status: "approved" } }),
  ])
  await refreshCounts([parent.postId])
  return toAdmin(await prisma.comment.findUniqueOrThrow({ where: { id }, include: adminInclude }))
}

// ---------- público ----------

/** Comentários aprovados de um post, com as respostas aprovadas. Sem e-mail nem dados internos. */
export async function publicComments(postId: number) {
  const rows = await prisma.comment.findMany({
    where: { postId, parentId: null, status: "approved" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { role: true } },
      replies: { where: { status: "approved" }, orderBy: { createdAt: "asc" }, include: { user: { select: { role: true } } } },
    },
  })
  type Row = { id: number; authorName: string; authorEmail: string; content: string; createdAt: Date; userId: number | null; user: { role: string } | null }
  const dto = (c: Row) => {
    const staff = !!c.user && c.user.role !== "reader"
    return {
      id: c.id,
      name: c.authorName,
      initials: initials(c.authorName),
      color: staff ? "#FF5A36" : colorFor(c.authorEmail),
      content: c.content,
      createdAt: c.createdAt,
      time: relativeTime(c.createdAt),
      staff,
      /** Autor do comentário (para o próprio leitor poder excluir). */
      userId: c.userId,
    }
  }
  return rows.map((c) => ({ ...dto(c), replies: c.replies.map(dto) }))
}
