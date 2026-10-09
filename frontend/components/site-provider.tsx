"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { api, errorMessage } from "@/lib/api"
import { useSiteUser } from "@/lib/site-session"

type SiteState = {
  query: string
  setQuery: (q: string) => void
  isSaved: (slug: string) => boolean
  toggleSave: (slug: string) => void
  /** Leva para /entrar e volta para a página atual depois do login. */
  goToLogin: (reason?: string) => void
}

const SiteContext = createContext<SiteState | null>(null)

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useSiteUser()
  const [query, setQuery] = useState("")
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  // Posts salvos ficam na conta (servidor), então aparecem em qualquer aparelho.
  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- signed out: nothing saved to show
      setSaved({})
      return
    }
    api
      .get<string[]>("/api/public/me/saved/slugs")
      .then((slugs) => setSaved(Object.fromEntries(slugs.map((s) => [s, true]))))
      .catch(() => {})
  }, [user])

  const goToLogin = useCallback(
    (reason?: string) => {
      if (reason) toast(reason)
      router.push(`/entrar?next=${encodeURIComponent(pathname || "/")}`)
    },
    [router, pathname]
  )

  const toggleSave = useCallback(
    (slug: string) => {
      if (!user) {
        toast("Entre na sua conta para salvar posts", { action: { label: "Entrar", onClick: () => goToLogin() } })
        return
      }
      const next = !saved[slug]
      setSaved((s) => ({ ...s, [slug]: next }))
      const req = next ? api.put(`/api/public/me/saved/${encodeURIComponent(slug)}`, {}) : api.del(`/api/public/me/saved/${encodeURIComponent(slug)}`)
      req
        .then(() => toast.success(next ? "Post salvo" : "Post removido dos salvos"))
        .catch((e) => {
          setSaved((s) => ({ ...s, [slug]: !next }))
          toast.error(errorMessage(e))
        })
    },
    [user, saved, goToLogin]
  )

  const value = useMemo(
    () => ({ query, setQuery, isSaved: (s: string) => !!saved[s], toggleSave, goToLogin }),
    [query, saved, toggleSave, goToLogin]
  )
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite() {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error("useSite must be used inside <SiteProvider>")
  return ctx
}
