"use client"

import { useSyncExternalStore } from "react"
import { API_URL, api } from "@/lib/api"

// Conta do leitor no site (comentar e salvar posts). O cookie de sessão é httpOnly;
// quem está logado é perguntado à API em /api/public/auth/me.

export type SiteUser = {
  id: number
  name: string
  email: string
  initials: string
  color: string
  avatarUrl: string
  /** Equipe do blog: pode abrir o painel. */
  staff: boolean
}

/** null = verificando; false = visitante sem conta. */
type State = SiteUser | false | null

let state: State = null
let checking: Promise<void> | null = null
const listeners = new Set<() => void>()

const set = (next: State) => {
  state = next
  listeners.forEach((l) => l())
}

export function refreshSiteUser() {
  checking ??= fetch(`${API_URL}/api/public/auth/me`, { credentials: "include" })
    .then(async (r) => set(r.ok ? await r.json() : false))
    .catch(() => set(false))
    .finally(() => {
      checking = null
    })
  return checking
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  if (state === null) void refreshSiteUser()
  return () => {
    listeners.delete(onChange)
  }
}

export function useSiteUser(): State {
  return useSyncExternalStore<State>(subscribe, () => state, () => null)
}

export async function siteLogin(email: string, password: string, remember: boolean) {
  const { user } = await api.post<{ user: SiteUser }>("/api/public/auth/login", { email, password, remember })
  set(user)
  return user
}

export async function siteRegister(data: { name: string; email: string; password: string; website?: string }) {
  const { user } = await api.post<{ user: SiteUser }>("/api/public/auth/register", data)
  set(user)
  return user
}

export async function siteLogout() {
  await api.post("/api/public/auth/logout").catch(() => {})
  set(false)
}

/** Volta só para caminhos internos do site (evita redirecionamento para outro domínio). */
export const safeNext = (next: string | null | undefined) => (next && /^\/(?!\/)/.test(next) && !next.startsWith("/painel") ? next : "/")
