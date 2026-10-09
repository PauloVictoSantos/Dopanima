// Cliente HTTP da API (backend Express). A sessão do painel é um cookie httpOnly
// emitido pela API: o JavaScript da página nunca vê o token (um XSS não consegue
// roubá-lo). As páginas públicas usam fetch no servidor (lib/public-api.ts).

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333").replace(/\/$/, "")

// Limpa o token que versões antigas guardavam no storage.
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("dopanima:token")
    sessionStorage.removeItem("dopanima:token")
  } catch {}
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}

/** Disparado quando a API responde 401: o painel volta para o login. */
export const UNAUTHORIZED_EVENT = "dopanima:unauthorized"
/** Disparado quando a API exige trocar a senha temporária. */
export const PASSWORD_CHANGE_EVENT = "dopanima:password-change"

type Query = Record<string, string | number | boolean | undefined | null>

const qs = (q?: Query) => {
  if (!q) return ""
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ""
}

async function request<T>(method: string, path: string, opts: { body?: unknown; query?: Query; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}${qs(opts.query)}`, {
      method,
      headers,
      credentials: "include",
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    })
  } catch {
    throw new ApiError(0, "Não foi possível falar com o servidor. A API está rodando?")
  }

  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (typeof window !== "undefined") {
      if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
      if (data.details?.code === "PASSWORD_CHANGE_REQUIRED") window.dispatchEvent(new Event(PASSWORD_CHANGE_EVENT))
    }
    throw new ApiError(res.status, data.error || `Erro ${res.status}`, data.details)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body: body ?? {} }),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, { body }),
  del: (path: string) => request<void>("DELETE", path),
  delJson: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData, method: "POST" | "PUT" = "POST") => request<T>(method, path, { form }),
}

/** Mensagem amigável de qualquer erro (para toasts). */
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado")
