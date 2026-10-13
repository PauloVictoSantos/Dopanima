// Cliente da Google Books API. A chave fica só no servidor; o navegador nunca fala com
// a API diretamente (só carrega as capas públicas de books.google.com).

import { env } from "../config/env"
import { HttpError } from "./http-error"

const API = "https://www.googleapis.com/books/v1"

type CacheEntry = { at: number; ttl: number; value: unknown }
const cache = new Map<string, CacheEntry>()
const MAX_CACHE = 500

export const HOUR = 3_600_000

/** IDs de volume do Google Books: 12 caracteres (letras, números, _ e -). */
export const isVolumeId = (id: string) => /^[A-Za-z0-9_-]{8,20}$/.test(id)

/**
 * GET na Google Books com cache em memória (a cota diária é limitada e os dados mudam pouco).
 * `ttl` em ms. Erros viram HttpError com mensagem em português.
 */
export async function booksGet<T>(path: string, params: Record<string, string | number | undefined> = {}, ttl = 12 * HOUR): Promise<T> {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") query.set(k, String(v))
  const key = `${path}?${query}`

  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T

  if (env.GOOGLE_BOOKS_API_KEY) query.set("key", env.GOOGLE_BOOKS_API_KEY)
  // O Google Books devolve 503 ("Service temporarily unavailable") de vez em quando, mesmo
  // para buscas que funcionam no segundo seguinte: tenta de novo algumas vezes.
  let res: Response | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 400 * attempt))
    try {
      res = await fetch(`${API}${path}?${query}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) })
    } catch {
      res = null
      continue
    }
    if (res.status < 500) break
  }
  if (!res) throw new HttpError(502, "O Google Books não respondeu. Tente de novo em instantes.")
  if (res.status >= 500) throw new HttpError(503, "O Google Books está instável no momento. Tente de novo em instantes.")
  if (res.status === 400 || res.status === 403) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    const msg = body?.error?.message ?? ""
    if (/api key|API_KEY|disabled|not been used/i.test(msg))
      throw new HttpError(502, "Chave do Google Books inválida ou API desativada no projeto do Google Cloud. Confira GOOGLE_BOOKS_API_KEY no .env da API.")
    if (res.status === 403) throw new HttpError(503, "Cota do Google Books esgotada. Tente mais tarde.")
  }
  if (res.status === 404) throw new HttpError(404, "Livro não encontrado no Google Books")
  if (res.status === 429) throw new HttpError(503, "Limite de requisições do Google Books atingido. Tente em alguns segundos.")
  if (!res.ok) throw new HttpError(502, `O Google Books respondeu com erro ${res.status}`)

  const value = (await res.json()) as T
  // Busca sem resultado não vai para o cache (às vezes é só instabilidade do Google).
  if (path === "/volumes" && !(value as { items?: unknown[] }).items?.length) return value
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!)
  cache.set(key, { at: Date.now(), ttl, value })
  return value
}

/** Só baixamos capas destes hosts (evita SSRF). */
const COVER_HOSTS = /^(books\.google\.com|books\.googleusercontent\.com|[a-z0-9-]+\.googleusercontent\.com)$/

/**
 * Normaliza a URL de capa que o Google devolve: força HTTPS, tira a "orelha" de página
 * dobrada (edge=curl) e, opcionalmente, pede uma largura maior.
 */
export function coverUrl(raw: string | undefined, width?: number) {
  if (!raw) return ""
  let u: URL
  try {
    u = new URL(raw.replace(/^http:/, "https:"))
  } catch {
    return ""
  }
  if (!COVER_HOSTS.test(u.hostname)) return ""
  u.searchParams.delete("edge")
  if (width) u.searchParams.set("fife", `w${width}`)
  return u.toString()
}

/** Baixa uma capa do Google Books (só dos hosts do Google). */
export async function downloadCover(url: string) {
  const u = new URL(url)
  if (u.protocol !== "https:" || !COVER_HOSTS.test(u.hostname)) throw new HttpError(400, "Endereço de capa inválido")
  const res = await fetch(u, { signal: AbortSignal.timeout(20_000), redirect: "error" })
  if (!res.ok) throw new HttpError(502, "Não foi possível baixar a capa do Google Books")
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > 15 * 1024 * 1024) throw new HttpError(400, "Imagem grande demais")
  return buf
}
