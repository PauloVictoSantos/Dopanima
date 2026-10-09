"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { motion, useMotionValueEvent, useScroll } from "motion/react"
import { Menu, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Logo } from "@/components/brand"
import { useSite } from "@/components/site-provider"
import { SiteAccount } from "@/components/site-account"
import { siteLogout, useSiteUser } from "@/lib/site-session"
import { cn } from "@/lib/utils"

export const NAV_LINKS = [
  { label: "Início", id: "top" },
  { label: "Filmes", id: "filmes" },
  { label: "Livros", id: "livros" },
  { label: "Séries", id: "series" },
  { label: "Notícias", id: "noticias" },
  { label: "O que assistir", id: "assistir" },
  { label: "Dopa Indica", id: "indica" },
]

/** Smooth-scrolls to a home section, or navigates home first from other pages. */
export function useGoToSection() {
  const pathname = usePathname()
  const router = useRouter()
  return (id: string) => {
    if (pathname !== "/") {
      router.push(id === "top" ? "/" : `/#${id}`)
      return
    }
    if (id === "top") return window.scrollTo({ top: 0, behavior: "smooth" })
    const el = document.getElementById(id)
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" })
  }
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const home = pathname === "/"
  const { query, setQuery } = useSite()
  const goTo = useGoToSection()
  const [menuOpen, setMenuOpen] = useState(false)
  const user = useSiteUser()
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 80))

  const solid = !home || scrolled

  const onSearch = (v: string) => {
    setQuery(v)
    if (!home) router.push("/")
  }

  return (
    <>
      <motion.header
        initial={false}
        animate={{ height: solid ? 72 : 96 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-400",
          solid ? "border-white/10 bg-dp-bg/88 backdrop-blur-[14px]" : "border-transparent bg-dp-bg/0"
        )}
      >
        <div className="mx-auto flex h-full max-w-[1280px] items-center gap-6 px-[clamp(16px,5vw,64px)]">
          <Link href="/" aria-label="Dopanima, página inicial" className="shrink-0 no-underline">
            <Logo />
          </Link>

          <nav aria-label="Principal" className="mx-auto hidden gap-7 lg:flex">
            {NAV_LINKS.map((l, i) => (
              <button
                key={l.id}
                onClick={() => goTo(l.id)}
                className={cn(
                  "cursor-pointer py-1.5 text-[13px] font-semibold transition-colors hover:text-dp-yellow",
                  i === 0 && home ? "text-dp-yellow" : "text-white"
                )}
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <label className="flex h-10 w-[clamp(140px,22vw,240px)] items-center gap-2 rounded-full border border-white/22 bg-white/10 px-4 backdrop-blur-md">
              <Search className="size-4 text-dp-muted" aria-hidden />
              <input
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Buscar posts"
                aria-label="Buscar posts"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
              />
            </label>
            <SiteAccount />
            <Button variant="ring" size="icon-lg" className="size-10 bg-dp-bg/40 lg:hidden" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>
              <Menu className="size-[18px]" />
            </Button>
          </div>
        </div>
      </motion.header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-[min(320px,86vw)] gap-1 border-white/15 bg-dp-bg p-6 text-white">
          <SheetTitle className="mb-5 font-display text-[22px] font-normal text-dp-yellow">Menu</SheetTitle>
          {NAV_LINKS.map((l, i) => (
            <motion.button
              key={l.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => {
                setMenuOpen(false)
                goTo(l.id)
              }}
              className={cn(
                "cursor-pointer border-b border-white/10 py-3.5 text-left text-base font-semibold",
                i === 0 && home ? "text-dp-yellow" : "text-white"
              )}
            >
              {l.label}
            </motion.button>
          ))}
          <div className="mt-5 flex flex-col gap-2">
            {user ? (
              <>
                <span className="text-xs text-dp-muted">Conectado como <b className="text-white">{user.name}</b></span>
                <Link href="/salvos" onClick={() => setMenuOpen(false)} className="py-2 text-base font-semibold text-white no-underline">Posts salvos</Link>
                {user.staff && <Link href="/painel" onClick={() => setMenuOpen(false)} className="py-2 text-base font-semibold text-white no-underline">Painel</Link>}
                <button
                  onClick={async () => {
                    setMenuOpen(false)
                    await siteLogout()
                  }}
                  className="cursor-pointer py-2 text-left text-base font-semibold text-[#FF8A73]"
                >
                  Sair
                </button>
              </>
            ) : (
              <Link
                href={`/entrar?next=${encodeURIComponent(pathname || "/")}`}
                onClick={() => setMenuOpen(false)}
                className="grid h-11 place-items-center rounded-full bg-dp-orange text-sm font-semibold text-white no-underline"
              >
                Entrar ou criar conta
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
