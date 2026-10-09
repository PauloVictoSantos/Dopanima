import bcrypt from "bcryptjs"
import { Router, type Request, type Response } from "express"
import rateLimit, { ipKeyGenerator } from "express-rate-limit"
import { z } from "zod"
import { ROLE_PERMISSIONS, type Role } from "../../lib/constants"
import { badRequest, conflict, forbidden, unauthorized } from "../../lib/http-error"
import { prisma } from "../../lib/prisma"
import { SESSION_COOKIE, passwordProblem, sessionCookie } from "../../lib/security"
import { parse } from "../../lib/validate"
import { authenticate, signToken } from "../../middlewares/auth"
import { hashPassword, toUserDto } from "../users/users.service"

const loginSchema = z.object({
  email: z.email("Digite um e-mail válido.").trim().toLowerCase().max(191),
  password: z.string().min(1, "Digite sua senha.").max(200),
  remember: z.boolean().default(true),
})

const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.email("Digite um e-mail válido.").trim().toLowerCase(),
    city: z.string().trim().max(100),
    bio: z.string().trim().max(1000),
    avatarUrl: z.string().trim().max(500).refine((v) => !v || /^https?:\/\//i.test(v), "A foto precisa ser uma URL http(s)"),
    currentPassword: z.string().max(200),
    newPassword: z.string().max(200),
  })
  .partial()

type UserRow = Parameters<typeof toUserDto>[0] & { mustChangePassword: boolean }
const withPermissions = (u: UserRow) => ({ ...toUserDto(u), mustChangePassword: u.mustChangePassword, permissions: ROLE_PERMISSIONS[u.role as Role] ?? [] })

// Mesmo custo de bcrypt quando o e-mail não existe: o tempo de resposta não revela contas.
// Gerado ao subir a API, para não pesar só na primeira tentativa.
const dummyHash = bcrypt.hash("dopanima-dummy-password", 10)
const dummyCompare = async (pw: string) => bcrypt.compare(pw, await dummyHash)

export const startSession = (res: Response, user: { id: number; tokenVersion: number }, remember: boolean) =>
  res.cookie(SESSION_COOKIE, signToken(user, remember), sessionCookie(remember))

const limitMsg = { error: "Muitas tentativas de login. Tente de novo em alguns minutos." }
// Por IP (vários e-mails) e por conta (um e-mail atacado de vários IPs).
export const loginByIp = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: limitMsg })
export const loginByAccount = rateLimit({
  windowMs: 15 * 60_000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: limitMsg,
  keyGenerator: (req: Request) => `acct:${String(req.body?.email ?? "").trim().toLowerCase() || ipKeyGenerator(req.ip ?? "")}`,
  // Login certo não conta contra o limite da conta.
  skipSuccessfulRequests: true,
})

export const authRouter = Router()

/** Confere e-mail e senha e abre a sessão. Painel recusa leitores; o site aceita todos. */
export async function logIn(req: Request, res: Response, opts: { panel: boolean }) {
  const { email, password, remember } = parse(loginSchema, req.body)
  const user = await prisma.user.findUnique({ where: { email } })
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : await dummyCompare(password)
  // Mesmo erro para e-mail inexistente e senha errada, para não revelar contas.
  if (!user || !ok) throw unauthorized("E-mail ou senha incorretos.")
  if (user.status === "suspended") throw forbidden("Esta conta está suspensa.")
  if (opts.panel && user.role === "reader") throw forbidden("Sua conta não tem acesso ao painel.")

  const updated = await prisma.user.update({
    where: { id: user.id },
    // O primeiro login de um convite pendente ativa a conta.
    data: { lastLoginAt: new Date(), ...(user.status === "pending" ? { status: "active" } : {}) },
    include: { _count: { select: { posts: true } } },
  })
  startSession(res, updated, remember)
  return updated
}

authRouter.post("/login", loginByIp, loginByAccount, async (req, res) => {
  res.json({ user: withPermissions(await logIn(req, res, { panel: true })) })
})

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookie(false), maxAge: undefined })
  res.status(204).end()
})

/** Encerra a sessão em todos os dispositivos. */
authRouter.post("/logout-all", authenticate, async (req, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 } } })
  res.clearCookie(SESSION_COOKIE, { ...sessionCookie(false), maxAge: undefined })
  res.status(204).end()
})

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { _count: { select: { posts: true } } } })
  res.json(withPermissions(user))
})

authRouter.patch("/me", authenticate, async (req, res) => {
  const { currentPassword, newPassword, ...data } = parse(profileSchema, req.body)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })
  if (user.mustChangePassword && !newPassword) throw badRequest("Defina uma nova senha antes de alterar o perfil.")
  if (data.email && data.email !== user.email && (await prisma.user.findUnique({ where: { email: data.email } })))
    throw conflict("Já existe um usuário com esse e-mail.")

  let passwordData = {}
  if (newPassword) {
    if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw badRequest("A senha atual não confere.")
    if (newPassword === currentPassword) throw badRequest("A nova senha precisa ser diferente da atual.")
    const problem = passwordProblem(newPassword, data.email ?? user.email)
    if (problem) throw badRequest(problem)
    // Trocar a senha derruba as outras sessões; esta recebe um cookie novo logo abaixo.
    passwordData = { passwordHash: await hashPassword(newPassword), mustChangePassword: false, tokenVersion: { increment: 1 } }
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { ...data, ...passwordData },
    include: { _count: { select: { posts: true } } },
  })
  if (newPassword) startSession(res, updated, true)
  res.json(withPermissions(updated))
})
