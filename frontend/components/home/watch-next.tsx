"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { TitleCardLink } from "@/components/post/tmdb-info"
import { API_URL } from "@/lib/api"
import type { TmdbCard } from "@/lib/dashboard-api"
import { cn } from "@/lib/utils"

// [rótulo, tipo, lista da TMDB]
const TABS: [string, "movie" | "tv", string][] = [
  ["Filmes em alta", "movie", "trending"],
  ["Séries em alta", "tv", "trending"],
  ["Nos cinemas", "movie", "now_playing"],
  ["Filmes mais bem avaliados", "movie", "top_rated"],
  ["Séries no ar", "tv", "on_the_air"],
]

/** "O que assistir": sugestões da TMDB. Some sozinho se a integração estiver desligada. */
export function WatchNext() {
  const [tab, setTab] = useState(0)
  const [data, setData] = useState<Record<number, TmdbCard[]>>({})
  const [enabled, setEnabled] = useState(true)
  const [, type, list] = TABS[tab]

  useEffect(() => {
    if (data[tab]) return
    let alive = true
    fetch(`${API_URL}/api/public/tmdb/suggestions?type=${type}&list=${list}`)
      .then((r) => (r.ok ? r.json() : { enabled: false, items: [] }))
      .then((r: { enabled: boolean; items: TmdbCard[] }) => {
        if (!alive) return
        if (!r.enabled) setEnabled(false)
        setData((d) => ({ ...d, [tab]: r.items }))
      })
      .catch(() => alive && setData((d) => ({ ...d, [tab]: [] })))
    return () => {
      alive = false
    }
  }, [tab, type, list, data])

  if (!enabled) return null
  const items = data[tab]

  return (
    <section id="assistir" aria-labelledby="h-assistir" className="mx-auto max-w-[1280px] scroll-mt-20 px-[clamp(16px,5vw,64px)] pt-14">
      <div className="mb-4 flex flex-col gap-3">
        <h2 id="h-assistir" className="m-0 text-2xl font-bold">O que assistir</h2>
        <div role="tablist" aria-label="Sugestões" className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
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
          ? items.map((c) => <TitleCardLink key={`${c.type}-${c.id}`} c={c} />)
          : Array.from({ length: 7 }, (_, i) => <span key={i} className="aspect-2/3 w-[150px] shrink-0 animate-pulse rounded-xl bg-white/6" />)}
      </motion.div>
      <p className="mt-1 text-[11px] text-[#9C8AA6]">Sugestões e imagens da TMDB. Títulos com o selo “Resenha” têm post no Dopanima.</p>
    </section>
  )
}
