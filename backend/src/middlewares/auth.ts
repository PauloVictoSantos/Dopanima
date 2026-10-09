import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"
import { can, type Permission, type Role } from "../lib/constants"
import { HttpError, forbidden, unauthorized } from "../lib/http-error"
import { prisma } from "../lib/prisma"
import { SESSION_COOKIE, isAllowedOrigin, readCookie, requestOrigin } from "../lib/security"

/** `tv` = tokenVersion do usuário: se mudar no banco, o token deixa de valer. */
type TokenPayload = { sub: number; tv: number }

const JWT_OPTS = { algorithm: "HS256", issuer: "dopanima-api", audience: "dopanima-painel" } as const

export const signToken = (user: { id: number; tokenVersion: number }, remember = true) =>
  jwt.sign({ sub: user.id, tv: user.tokenVersion }, env.JWT_SECRET, { ...JWT_OPTS, expiresIn: remember ? "30d" : "12h" })

// Com senha temporária, só dá para ver o próprio perfil, trocar a senha e sair.
const ALLOWED_WHILE_MUST_CHANGE = new Set(["GET /api/auth/me", "PATCH /api/auth/me", "POST /api/auth/logout"])

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * Valida a sessão (cookie httpOnly ou header Bearer) e devolve o usuário ativo.
 * Com cookie, requisições que alteram dados precisam vir de uma origem
 * autorizada (proteção CSRF).
 */
async function sessionUser(req: Request) {
  const header = req.headers.authorization ?? ""
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : ""
  const token = bearer || readCookie(req, SESSION_COOKIE) || ""
  if (!token) throw unauthorized()

  if (!bearer && !SAFE_METHODS.has(req.method) && !isAllowedOrigin(requestOrigin(req)))
    throw forbidden("Origem da requisição não autorizada")

  let payload: TokenPayload
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"], issuer: JWT_OPTS.issuer, audience: JWT_OPTS.audience }) as unknown as TokenPayload
  } catch {
    throw unauthorized("Sessão expirada. Faça login novamente")
  }

  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } })
  if (!user || user.status === "suspended" || user.tokenVersion !== payload.tv) throw unauthorized("Sessão encerrada. Faça login novamente")
  return user
}

/** Painel: exige sessão de alguém da equipe (leitores não entram). */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const user = await sessionUser(req)
  if (user.role === "reader") throw forbidden("Sua conta não tem acesso ao painel.")
  if (user.mustChangePassword && !ALLOWED_WHILE_MUST_CHANGE.has(`${req.method} ${req.baseUrl}${req.path}`.replace(/\/$/, "")))
    throw new HttpError(403, "Troque a senha temporária para continuar", { code: "PASSWORD_CHANGE_REQUIRED" })

  req.user = { id: user.id, role: user.role as Role, name: user.name, email: user.email }
  next()
}

/** Exige que a função do usuário tenha ao menos uma das permissões. */
export const requirePermission =
  (...perms: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized()
    if (!perms.some((p) => can(req.user!.role, p))) throw forbidden()
    next()
  }

/** Site público: qualquer conta ativa (leitores e equipe), para comentar e salvar posts. */
export async function authenticateSite(req: Request, _res: Response, next: NextFunction) {
  const user = await sessionUser(req)
  req.user = { id: user.id, role: user.role as Role, name: user.name, email: user.email }
  next()
}
