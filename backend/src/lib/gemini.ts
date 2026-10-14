// Cliente da API do Gemini. A chave fica só no servidor; o navegador fala com /api/ai.

import { env } from "../config/env"
import { HttpError } from "./http-error"

const API = "https://generativelanguage.googleapis.com/v1beta/models"

export const geminiConfigured = () => !!env.GEMINI_API_KEY

type Part = { text?: string }
type Raw = {
  candidates?: {
    content?: { parts?: Part[] }
    finishReason?: string
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[]; webSearchQueries?: string[] }
  }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

export type GeminiOptions = {
  system: string
  prompt: string
  /** Busca no Google (grounding): devolve as fontes reais consultadas. */
  search?: boolean
  /** Resposta em JSON seguindo este schema (não combina com `search`). */
  schema?: object
  temperature?: number
  maxTokens?: number
}

export type Source = { title: string; url: string }

/** Chama o Gemini e devolve o texto gerado e, com busca, as fontes usadas. */
export async function generate(o: GeminiOptions): Promise<{ text: string; sources: Source[] }> {
  if (!geminiConfigured()) throw new HttpError(503, "Assistente de IA desligado: defina GEMINI_API_KEY no .env da API.")

  const body = {
    systemInstruction: { parts: [{ text: o.system }] },
    contents: [{ role: "user", parts: [{ text: o.prompt }] }],
    generationConfig: {
      temperature: o.temperature ?? 0.7,
      maxOutputTokens: o.maxTokens ?? 8192,
      // Nos modelos "flash", o raciocínio interno gasta tokens de saída à toa para estas tarefas.
      ...(/flash/.test(env.GEMINI_MODEL) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      ...(o.schema ? { responseMimeType: "application/json", responseSchema: o.schema } : {}),
    },
    ...(o.search ? { tools: [{ google_search: {} }] } : {}),
  }

  let res: Response
  try {
    res = await fetch(`${API}/${env.GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    })
  } catch {
    throw new HttpError(502, "O Gemini não respondeu. Tente de novo em instantes.")
  }
  const data = (await res.json().catch(() => ({}))) as Raw
  if (!res.ok) {
    const msg = data.error?.message ?? ""
    if (/api key not valid|API_KEY_INVALID/i.test(msg) || res.status === 401 || res.status === 403)
      throw new HttpError(502, "Chave do Gemini inválida ou sem permissão. Confira GEMINI_API_KEY no .env da API.")
    if (res.status === 404) throw new HttpError(502, `Modelo "${env.GEMINI_MODEL}" não encontrado. Confira GEMINI_MODEL no .env da API.`)
    if (res.status === 429) throw new HttpError(503, "Cota da chave do Gemini esgotada no momento. Tente mais tarde.")
    if (res.status >= 500) throw new HttpError(503, "O Gemini está sobrecarregado. Tente de novo em instantes.")
    throw new HttpError(502, `O Gemini recusou o pedido (${res.status}).`)
  }

  if (data.promptFeedback?.blockReason) throw new HttpError(422, "O Gemini recusou o pedido por política de conteúdo. Reformule o texto.")
  const c = data.candidates?.[0]
  const text = (c?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim()
  if (!text) {
    if (c?.finishReason === "SAFETY") throw new HttpError(422, "O Gemini recusou o pedido por política de conteúdo. Reformule o texto.")
    throw new HttpError(502, "O Gemini não devolveu texto. Tente de novo.")
  }

  // Fontes vêm dos metadados da busca (links reais), nunca de URLs escritas pelo modelo.
  const seen = new Set<string>()
  const sources: Source[] = []
  for (const ch of c?.groundingMetadata?.groundingChunks ?? []) {
    const url = ch.web?.uri ?? ""
    if (!/^https:\/\//i.test(url) || seen.has(url)) continue
    seen.add(url)
    sources.push({ title: (ch.web?.title ?? new URL(url).hostname).slice(0, 200), url })
  }
  return { text, sources }
}
