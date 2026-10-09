import crypto from "node:crypto"
import type { CookieOptions, Request } from "express"
import { env } from "../config/env"

export const SESSION_COOKIE = "dopanima_session"

/** Cookie da sessão: httpOnly (JavaScript não lê), SameSite=Lax, Secure em produção. */
export const sessionCookie = (remember: boolean): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  path: "/",
  // Sem "lembrar de mim" vira cookie de sessão do navegador.
  ...(remember ? { maxAge: 30 * 24 * 60 * 60 * 1000 } : {}),
})

export function readCookie(req: Request, name: string) {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(";")) {
    const i = part.indexOf("=")
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return undefined
}

/** Origem da requisição (Origin, ou Referer como alternativa). */
export function requestOrigin(req: Request) {
  const origin = req.headers.origin
  if (origin) return origin.replace(/\/$/, "")
  const ref = req.headers.referer
  if (!ref) return undefined
  try {
    return new URL(ref).origin
  } catch {
    return undefined
  }
}

export const isAllowedOrigin = (origin: string | undefined) => !!origin && env.ALLOWED_ORIGINS.includes(origin)

/** Hash do IP com segredo do servidor: serve para moderação/limites sem guardar o IP. */
export const hashIp = (ip: string | undefined) =>
  crypto.createHmac("sha256", env.JWT_SECRET).update(ip ?? "").digest("hex")

const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "senha123", "senha1234", "qwerty123",
  "abc12345", "11111111", "00000000", "iloveyou", "admin123", "dopanima123", "mudar123", "brasil123",
])

/** Regra de senha: 8+ caracteres, não pode ser comum nem igual ao e-mail. */
export function passwordProblem(pw: string, email?: string) {
  if (pw.length < 8) return "A senha precisa ter ao menos 8 caracteres."
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return "Essa senha é muito comum. Escolha outra."
  if (email && pw.toLowerCase() === email.toLowerCase()) return "A senha não pode ser igual ao e-mail."
  if (/^(.)\1+$/.test(pw)) return "A senha não pode ser um caractere repetido."
  return null
}
