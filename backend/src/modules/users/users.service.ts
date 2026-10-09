import crypto from "node:crypto"
import bcrypt from "bcryptjs"
import type { Prisma, User } from "@prisma/client"
import { z } from "zod"
import { ROLES, USER_COLORS, USER_STATUSES, type Role } from "../../lib/constants"
import { dateLabel, initials, isoDay, relativeTime } from "../../lib/format"
import { badRequest, conflict, forbidden, notFound } from "../../lib/http-error"
import { passwordProblem } from "../../lib/security"
import { prisma } from "../../lib/prisma"

type Actor = NonNullable<Express.Request["user"]>

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10)
export const tempPassword = () => crypto.randomBytes(12).toString("base64url")

export function toUserDto(u: User & { _count?: { posts: number } }) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    city: u.city,
    color: u.color,
    initials: initials(u.name),
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    posts: u._count?.posts ?? 0,
    comments: 0,
    createdAt: u.createdAt,
    joined: dateLabel(u.createdAt),
    lastLoginAt: u.lastLoginAt,
    last: relativeTime(u.lastLoginAt),
  }
}

const password = z.string().max(200)

export const createSchema = z.object({
  name: z.string().trim().min(1, "Digite o nome.").max(100),
  email: z.email("Digite um e-mail válido.").trim().toLowerCase(),
  role: z.enum(ROLES).default("reader"),
  city: z.string().trim().max(100).default(""),
  password: password.optional(),
})

export const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.email("Digite um e-mail válido.").trim().toLowerCase(),
    role: z.enum(ROLES),
    status: z.enum(USER_STATUSES),
    city: z.string().trim().max(100),
    bio: z.string().trim().max(1000),
    password,
  })
  .partial()

export const listSchema = z.object({
  q: z.string().trim().default(""),
  tab: z.enum(["all", "team", "readers", "pending", "suspended"]).default("all"),
  role: z.enum([...ROLES, "all"]).default("all"),
  sort: z.enum(["recent", "active", "name"]).default("recent"),
})

const tabWhere = (tab: z.infer<typeof listSchema>["tab"]): Prisma.UserWhereInput =>
  tab === "team" ? { role: { not: "reader" } }
    : tab === "readers" ? { role: "reader" }
    : tab === "pending" ? { status: "pending" }
    : tab === "suspended" ? { status: "suspended" }
    : {}

export async function listUsers(query: z.infer<typeof listSchema>) {
  const search: Prisma.UserWhereInput = {
    ...(query.role !== "all" ? { role: query.role } : {}),
    ...(query.q ? { OR: [{ name: { contains: query.q } }, { email: { contains: query.q.toLowerCase() } }] } : {}),
  }
  const orderBy: Prisma.UserOrderByWithRelationInput =
    query.sort === "name" ? { name: "asc" } : query.sort === "active" ? { lastLoginAt: { sort: "desc", nulls: "last" } } : { createdAt: "desc" }

  const tabs = ["all", "team", "readers", "pending", "suspended"] as const
  const [items, ...tabCounts] = await Promise.all([
    prisma.user.findMany({ where: { ...search, ...tabWhere(query.tab) }, orderBy, include: { _count: { select: { posts: true } } } }),
    ...tabs.map((t) => prisma.user.count({ where: { ...search, ...tabWhere(t) } })),
  ])
  return { items: items.map(toUserDto), counts: Object.fromEntries(tabs.map((t, i) => [t, tabCounts[i]])) }
}

/** KPIs e cadastros por dia nos últimos 30 dias. */
export async function userStats() {
  const since = new Date(Date.now() - 30 * 86400000)
  const [total, activeMonth, suspended, byRoleRows, recent] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastLoginAt: { gte: since } } }),
    prisma.user.count({ where: { status: "suspended" } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
  ])
  const byRole = Object.fromEntries(ROLES.map((r) => [r, byRoleRows.find((x) => x.role === r)?._count._all ?? 0]))
  const days = Array.from({ length: 30 }, (_, i) => isoDay(new Date(Date.now() - (29 - i) * 86400000)))
  const signups = days.map((d) => recent.filter((u) => isoDay(u.createdAt) === d).length)
  return {
    total,
    activeMonth,
    suspended,
    team: total - byRole.reader,
    newLast30: recent.length,
    byRole,
    signups,
    signupsFrom: days[0],
    signupsTo: days[29],
  }
}

export async function listAuthors() {
  const users = await prisma.user.findMany({ where: { role: { not: "reader" }, status: { not: "suspended" } }, orderBy: { name: "asc" } })
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role, initials: initials(u.name), color: u.color }))
}

async function load(id: number) {
  const u = await prisma.user.findUnique({ where: { id }, include: { _count: { select: { posts: true } } } })
  if (!u) throw notFound("Usuário não encontrado")
  return u
}

export const getUser = async (id: number) => toUserDto(await load(id))

/** Impede ficar sem nenhum Super Admin ativo. */
async function assertKeepsAdmin(ids: number[]) {
  const remaining = await prisma.user.count({ where: { role: "super_admin", status: "active", id: { notIn: ids } } })
  if (!remaining) throw badRequest("O site precisa de ao menos um Super Admin ativo")
}

export async function createUser(input: z.infer<typeof createSchema>) {
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict("Já existe um usuário com esse e-mail.")
  const problem = input.password ? passwordProblem(input.password, input.email) : null
  if (problem) throw badRequest(problem)
  const temporaryPassword = input.password ? undefined : tempPassword()
  const count = await prisma.user.count()
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      city: input.city,
      status: "pending",
      // Senha definida pelo admin também é temporária: o usuário troca no primeiro acesso.
      mustChangePassword: true,
      color: USER_COLORS[count % USER_COLORS.length],
      passwordHash: await hashPassword(input.password ?? temporaryPassword!),
    },
    include: { _count: { select: { posts: true } } },
  })
  return { user: toUserDto(user), temporaryPassword }
}

export async function updateUser(actor: Actor, id: number, input: z.infer<typeof updateSchema>) {
  const current = await load(id)
  if (id === actor.id && ((input.role && input.role !== current.role) || (input.status && input.status !== current.status)))
    throw forbidden("Você não pode mudar a própria função ou status")
  if (input.email && input.email !== current.email && (await prisma.user.findUnique({ where: { email: input.email } })))
    throw conflict("Já existe um usuário com esse e-mail.")
  if (current.role === "super_admin" && ((input.role && input.role !== "super_admin") || (input.status && input.status !== "active")))
    await assertKeepsAdmin([id])

  const { password, ...rest } = input
  if (password) {
    const problem = passwordProblem(password, input.email ?? current.email)
    if (problem) throw badRequest(problem)
  }
  // Nova senha, função ou status derrubam as sessões abertas desse usuário.
  const revoke = !!password || (input.role && input.role !== current.role) || (input.status && input.status !== current.status)
  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(password ? { passwordHash: await hashPassword(password), mustChangePassword: true } : {}),
      ...(revoke ? { tokenVersion: { increment: 1 } } : {}),
    },
    include: { _count: { select: { posts: true } } },
  })
  return toUserDto(user)
}

/** Exclui usuários; os posts deles passam para quem excluiu. */
export async function deleteUsers(actor: Actor, ids: number[]) {
  if (ids.includes(actor.id)) throw forbidden("Você não pode excluir a própria conta")
  await assertKeepsAdmin(ids)
  await prisma.$transaction([
    prisma.post.updateMany({ where: { authorId: { in: ids } }, data: { authorId: actor.id } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ])
}

export async function bulkStatus(actor: Actor, ids: number[], status: "active" | "suspended") {
  if (ids.includes(actor.id)) throw forbidden("Você não pode alterar a própria conta em massa")
  if (status === "suspended") await assertKeepsAdmin(ids)
  const { count } = await prisma.user.updateMany({ where: { id: { in: ids } }, data: { status, tokenVersion: { increment: 1 } } })
  return { updated: count }
}

/** Gera uma senha temporária (não há serviço de e-mail; o admin repassa ao usuário). */
export async function resetPassword(id: number) {
  await load(id)
  const temporaryPassword = tempPassword()
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true, tokenVersion: { increment: 1 } },
  })
  return { temporaryPassword }
}

export const isRole = (r: string): r is Role => (ROLES as readonly string[]).includes(r)
