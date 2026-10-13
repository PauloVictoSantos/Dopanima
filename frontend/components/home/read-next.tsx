"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { BookCardLink } from "@/components/post/book-info"
import { API_URL } from "@/lib/api"
import type { BookCard } from "@/lib/dashboard-api"
import { cn } from "@/lib/utils"

// [rótulo, lista do backend]
const TABS: [string, string][] = [
  ["Fantasia", "fantasy"],
  ["Terror", "horror"],
  ["Suspense", "thriller"],
  ["Ficção científica", "scifi"],
  ["Romance", "romance"],
  ["Literatura brasileira", "brazil"],
  ["HQs e mangás", "comics"],
]

/** "O que ler": sugestões do Google Books por gênero. Some sozinho se a API não responder. */
export function ReadNext() {
  const [tab, setTab] = useState(0)
  const [data, setData] = useState<Record<number, BookCard[]>>({})
  const [enabled, setEnabled] = useState(true)
  const [, list] = TABS[tab]

  useEffect(() => {
    if (data[tab]) return
    let alive = true
    fetch(`${API_URL}/api/public/books/suggestions?list=${list}`)
      .then((r) => (r.ok ? r.json() : { enabled: false, items: [] }))
      .then((r: { enabled: boolean; items: BookCard[] }) => {
        if (!alive) return
        // Só esconde a seção se a primeira aba falhar; nas outras, mostra a aba vazia.
        if (!r.enabled && !Object.keys(data).length) setEnabled(false)
        setData((d) => ({ ...d, [tab]: r.items }))
      })
      .catch(() => alive && setData((d) => ({ ...d, [tab]: [] })))
    return () => {
      alive = false
    }
  }, [tab, list, data])

  if (!enabled) return null
  const items = data[tab]

  return (
    <section id="ler" aria-labelledby="h-ler" className="mx-auto max-w-[1280px] scroll-mt-20 px-[clamp(16px,5vw,64px)] pt-14">
      <div className="mb-4 flex flex-col gap-3">
        <h2 id="h-ler" className="m-0 text-2xl font-bold">O que ler</h2>
        <div role="tablist" aria-label="Sugestões de livros" className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {TABS.map(([label], i) => (
            <button
              key={label}
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={cn(
                "h-9 shrink-0 cursor-pointer rounded-full border px-4 text-xs font-semibold transition-colors",
                tab === i ? "border-dp-yellow bg-dp-yellow text-dp-bg" : "border-white/30 text-white hover:border-dp-yellow"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="no-scrollbar -mx-2 flex snap-x gap-4 overflow-x-auto px-2 pb-3">
        {items
          ? items.length
            ? items.map((c) => <BookCardLink key={c.id} c={c} />)
            : <p className="m-0 py-8 text-sm text-dp-muted">Não foi possível carregar os livros agora. Tente outra aba ou volte mais tarde.</p>
          : Array.from({ length: 7 }, (_, i) => <span key={i} className="aspect-2/3 w-[150px] shrink-0 animate-pulse rounded-xl bg-white/6" />)}
      </motion.div>
      <p className="mt-1 text-[11px] text-[#9C8AA6]">Sugestões e capas do Google Books. Livros com o selo “Resenha” têm post no Dopanima.</p>
    </section>
  )
}
