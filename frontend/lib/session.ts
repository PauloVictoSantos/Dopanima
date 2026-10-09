"use client"

import { useSyncExternalStore } from "react"
import { api, UNAUTHORIZED_EVENT } from "@/lib/api"

// Sessão do painel: cookie httpOnly emitido pela API. O navegador não consegue
// ler o cookie, então "estou logado?" é respondido pela própria API (/api/auth/me).

export type Me = {
  id: number
  name: string
  email: string
  role: string
  status: string
  city: string
  bio: string
  color: string
  initials: string
  avatarUrl: string
  posts: number
  mustChangePassword: boolean
  permissions: string[]
}

/** null = ainda verificando; false = sem sessão; Me = logado. */
type State = Me | false | null

let state: State = null
let checking: Promise<void> | null = null
const listeners = new Set<() => void>()

const set = (next: State) => {
  state = next
  listeners.forEach((l) => l())
}

/** Pergunta à API quem está logado (uma vez; chamadas simultâneas compartilham a mesma requisição). */
export function refreshSession() {
  checking ??= api
    .get<Me>("/api/auth/me")
    .then((me) => set(me))
    .catch(() => set(false))
    .finally(() => {
      checking = null
    })
  return checking
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  const expired = () => set(false)
  window.addEventListener(UNAUTHORIZED_EVENT, expired)
  if (state === null) void refreshSession()
  return () => {
    listeners.delete(onChange)
    window.removeEventListener(UNAUTHORIZED_EVENT, expired)
  }
}

/** Usuário logado (Me), false sem sessão, null enquanto verifica / durante o SSR. */
export function useSession(): State {
  return useSyncExternalStore<State>(subscribe, () => state, () => null)
}

/** true/false once known on the client; null while checking. */
export function useSignedIn(): boolean | null {
  const s = useSession()
  return s === null ? null : !!s
}

export async function signIn(email: string, password: string, remember: boolean) {
  const { user } = await api.post<{ user: Me }>("/api/auth/login", { email, password, remember })
  set(user)
  return user
}

export async function signOut() {
  await api.post("/api/auth/logout").catch(() => {})
  set(false)
}

/** Encerra a sessão em todos os dispositivos (inclusive este). */
export async function signOutEverywhere() {
  await api.post("/api/auth/logout-all")
  set(false)
}

export const fetchMe = async () => {
  await refreshSession()
  if (!state) throw new Error("Sessão expirada")
  return state
}

/** Atualiza o usuário guardado depois de mudar o perfil/senha. */
export const setMe = (me: Me) => set(me)
