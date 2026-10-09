// Cliente da API da TMDB (The Movie Database). A chave fica só no servidor; o
// navegador nunca fala com a TMDB diretamente (só carrega as imagens públicas).

import { env } from "../config/env"
import { HttpError } from "./http-error"

const API = "https://api.themoviedb.org/3"
export const IMAGE_BASE = "https://image.tmdb.org/t/p"

export const tmdbConfigured = () => !!env.TMDB_TOKEN

/** v4 (token de leitura, JWT "eyJ...") vai no header; v3 (chave curta) vai na query. */
const isV4 = () => (env.TMDB_TOKEN ?? "").startsWith("eyJ")

type CacheEntry = { at: number; ttl: number; value: unknown }
const cache = new Map<string, CacheEntry>()
const MAX_CACHE = 500

export const HOUR = 3_600_000

/**
 * GET na TMDB com cache em memória (a TMDB limita requisições e os dados mudam pouco).
 * `ttl` em ms. Erros viram HttpError com mensagem em português.
 */
export async function tmdbGet<T>(path: string, params: Record<string, string | number | undefined> = {}, ttl = 6 * HOUR): Promise<T> {
  if (!tmdbConfigured()) throw new HttpError(503, "Integração com a TMDB não configurada (defina TMDB_TOKEN no .env da API)")

  const query = new URLSearchParams()
  query.set("language", env.TMDB_LANGUAGE)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") query.set(k, String(v))
  const key = `${path}?${query}`

  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T

  if (!isV4()) query.set("api_key", env.TMDB_TOKEN!)
  let res: Response
  try {
    res = await fetch(`${API}${path}?${query}`, {
      headers: { accept: "application/json", ...(isV4() ? { authorization: `Bearer ${env.TMDB_TOKEN}` } : {}) },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new HttpError(502, "A TMDB não respondeu. Tente de novo em instantes.")
  }
  if (res.status === 401) throw new HttpError(502, "Chave da TMDB inválida. Confira TMDB_TOKEN no .env da API.")
  if (res.status === 404) throw new HttpError(404, "Título não encontrado na TMDB")
  if (res.status === 429) throw new HttpError(503, "Limite de requisições da TMDB atingido. Tente em alguns segundos.")
  if (!res.ok) throw new HttpError(502, `A TMDB respondeu com erro ${res.status}`)

  const value = (await res.json()) as T
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!)
  cache.set(key, { at: Date.now(), ttl, value })
  return value
}

/** URL pública de imagem da TMDB. Tamanhos: w92, w185, w342, w500, w780, w1280, original. */
export const tmdbImage = (path: string | null | undefined, size = "w500") => (path ? `${IMAGE_BASE}/${size}${path}` : "")

/** Caminhos de imagem da TMDB têm este formato; qualquer outra coisa é recusada (evita SSRF). */
export const isTmdbImagePath = (p: string) => /^\/[A-Za-z0-9_-]{6,64}\.(jpg|jpeg|png|webp)$/.test(p)

/** Baixa uma imagem da TMDB (só do host image.tmdb.org). */
export async function downloadTmdbImage(path: string, size: string) {
  if (!isTmdbImagePath(path)) throw new HttpError(400, "Caminho de imagem da TMDB inválido")
  const res = await fetch(`${IMAGE_BASE}/${size}${path}`, { signal: AbortSignal.timeout(20_000), redirect: "error" })
  if (!res.ok) throw new HttpError(502, "Não foi possível baixar a imagem da TMDB")
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > 15 * 1024 * 1024) throw new HttpError(400, "Imagem grande demais")
  return { buf, mime: res.headers.get("content-type") ?? "image/jpeg" }
}
