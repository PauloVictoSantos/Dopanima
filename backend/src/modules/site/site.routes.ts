// Contas do site público: leitores se cadastram para comentar e salvar posts.
// Usa o mesmo cookie de sessão do painel, mas leitores não acessam /api/auth nem o painel.

import { Router } from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import { USER_COLORS } from "../../lib/constants"
import { initials } from "../../lib/format"
import { badRequest, conflict, notFound } from "../../lib/http-error"
import { prisma } from "../../lib/prisma"
import { SESSION_COOKIE, passwordProblem, sessionCookie } from "../../lib/security"
import { parse } from "../../lib/validate"
import { authenticateSite } from "../../middlewares/auth"
import { logIn, loginByAccount, loginByIp, startSession } from "../auth/auth.routes"
import { postInclude, toPublicPost } from "../posts/posts.mapper"
import { hashPassword } from "../users/users.service"
import { refreshCounts } from "../comments/comments.service"

const registerSchema = z.object({
  name: z.string().trim().min(2, "Digite seu nome.").max(80),
  email: z.email("Digite um e-mail válido.").trim().toLowerCase().max(191),
  password: z.string().max(200),
  /** Campo isca contra robôs. */
  website: z.string().max(200).optional(),
})

type SiteUser = { id: number; name: string; email: string; role: string; color: string; avatarUrl: string }
const toSiteUser = (u: SiteUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  initials: initials(u.name),
  color: u.color,
  avatarUrl: u.avatarUrl,
  /** Equipe do blog (pode abrir o painel). */
  staff: u.role !== "reader",
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitos cadastros a partir desta rede. Tente de novo mais tarde." },
})

const livePost = (slug: string) =>
  prisma.post.findFirst({ where: { slug: slug.slice(0, 191), status: "published", publishedAt: { lte: new Date() } }, select: { id: true } })

export const siteRouter = Router()

siteRouter.post("/auth/register", registerLimiter, async (req, res) => {
  const data = parse(registerSchema, req.body)
  if (data.website) throw badRequest("Não foi possível criar a conta.")
  const problem = passwordProblem(data.password, data.email)
  if (problem) throw badRequest(problem)
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw conflict("Já existe uma conta com esse e-mail. Entre com sua senha.")
  const count = await prisma.user.count()
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      // Leitores nunca recebem acesso ao painel por aqui; só um admin muda a função.
      role: "reader",
      status: "active",
      color: USER_COLORS[count % USER_COLORS.length],
      lastLoginAt: new Date(),
    },
  })
  startSession(res, user, true)
  res.status(201).json({ user: toSiteUser(user) })
})

siteRouter.post("/auth/login", loginByIp, loginByAccount, async (req, res) => {
  res.json({ user: toSiteUser(await logIn(req, res, { panel: false })) })
})

siteRouter.post("/auth/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookie(false), maxAge: undefined })
  res.status(204).end()
})

siteRouter.get("/auth/me", authenticateSite, async (req, res) => {
  res.json(toSiteUser(await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } })))
})

// ---------- comentários do próprio leitor ----------

siteRouter.delete("/me/comments/:id", authenticateSite, async (req, res) => {
  const id = Number(req.params.id)
  const c = Number.isInteger(id) ? await prisma.comment.findUnique({ where: { id }, select: { userId: true, postId: true } }) : null
  // Só o autor exclui por aqui; a equipe usa a moderação do painel.
  if (!c || c.userId !== req.user!.id) throw notFound("Comentário não encontrado")
  await prisma.comment.delete({ where: { id } })
  await refreshCounts([c.postId])
  res.status(204).end()
})

// ---------- posts salvos ----------

/** Só os slugs, para marcar o botão "salvar" nos cards. */
siteRouter.get("/me/saved/slugs", authenticateSite, async (req, res) => {
  const rows = await prisma.savedPost.findMany({ where: { userId: req.user!.id }, select: { post: { select: { slug: true } } } })
  res.json(rows.map((r) => r.post.slug))
})

siteRouter.get("/me/saved", authenticateSite, async (req, res) => {
  const rows = await prisma.savedPost.findMany({
    where: { userId: req.user!.id, post: { status: "published", publishedAt: { lte: new Date() } } },
    orderBy: { createdAt: "desc" },
    include: { post: { include: postInclude } },
  })
  res.json(rows.map((r) => toPublicPost(r.post)))
})

siteRouter.put("/me/saved/:slug", authenticateSite, async (req, res) => {
  const post = await livePost(String(req.params.slug))
  if (!post) throw notFound("Post não encontrado")
  await prisma.savedPost.upsert({
    where: { userId_postId: { userId: req.user!.id, postId: post.id } },
    create: { userId: req.user!.id, postId: post.id },
    update: {},
  })
  res.status(204).end()
})

siteRouter.delete("/me/saved/:slug", authenticateSite, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { slug: String(req.params.slug).slice(0, 191) }, select: { id: true } })
  if (post) await prisma.savedPost.deleteMany({ where: { userId: req.user!.id, postId: post.id } })
  res.status(204).end()
})
