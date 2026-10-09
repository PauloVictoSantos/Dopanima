"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSite } from "@/components/site-provider"
import { useGoToSection } from "@/components/site-header"
import { Rail } from "@/components/rail"
import { BookCard, NewsCard, PosterCard } from "@/components/cards"
import { Hero } from "@/components/home/hero"
import { BookFeature, FilmFeature } from "@/components/home/features"
import { DopaIndica, Newsletter } from "@/components/home/extras"
import { WatchNext } from "@/components/home/watch-next"
import { FILTERS, FILTER_FN, searchPosts, type Filter, type HomeData, type Post, type PostType } from "@/lib/posts"
import { cn } from "@/lib/utils"

export default function HomePage({ data }: { data: HomeData }) {
  const { query } = useSite()
  const goTo = useGoToSection()
  const [filter, setFilter] = useState<Filter>("Tudo")
  const [results, setResults] = useState<{ q: string; posts: Post[] } | null>(null)

  // A busca do header roda na API (título, subtítulo e resumo).
  const q = query.trim()
  useEffect(() => {
    if (!q) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      searchPosts(q, ctrl.signal)
        .then((posts) => setResults({ q, posts }))
        .catch(() => {})
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  const match = !q ? data.posts : results?.q === q ? results.posts : []
  const ofType = (t: PostType) => match.filter((p) => p.type === t)
  const recent = match.filter(FILTER_FN[filter]).slice(0, 10)
  const films = ofType("filme")
  const series = ofType("serie")
  const books = ofType("livro")
  const news = ofType("noticia")

  const viewAll = (f: Filter) => () => {
    setFilter(f)
    goTo("recentes")
  }

  return (
    <motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      {data.hero.length > 0 && <Hero posts={data.hero} />}

      <section aria-label="Filtros" className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)] pt-8">
        <div role="toolbar" aria-label="Filtrar posts recentes" className="no-scrollbar flex items-center gap-3 overflow-x-auto px-0.5 py-1">
          {FILTERS.map((f) => {
            const active = f === filter
            return (
              <motion.button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={active}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "relative isolate h-10 shrink-0 cursor-pointer rounded-full border px-7 text-[13px] font-semibold transition-colors duration-300",
                  active ? "border-dp-yellow text-dp-bg" : "border-white text-white"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="filter-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-dp-yellow"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{f}</span>
              </motion.button>
            )
          })}
          <Button
            variant="ring"
            size="icon-lg"
            aria-label="Próximo filtro"
            className="size-10 shrink-0 border-white"
            onClick={() => setFilter(FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length])}
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      <Rail
        id="recentes"
        title="Posts recentes"
        label="Carrossel de posts recentes"
        onViewAll={viewAll("Tudo")}
        empty={!recent.length && "Nenhum post encontrado para esse filtro ou busca."}
      >
        {recent.map((p, i) => (
          <PosterCard key={`${filter}-${p.slug}`} post={p} index={i} />
        ))}
      </Rail>

      <FilmFeature posts={data.filmFeatures} />

      <Rail id="filmes" title="Filmes" label="Carrossel de filmes" onViewAll={viewAll("Filmes")} empty={!films.length && "Nenhum filme encontrado."}>
        {films.map((p) => (
          <PosterCard key={p.slug} post={p} badge={p.sub} badgeColor="#FF5A36" />
        ))}
      </Rail>

      <Rail id="series" title="Séries" label="Carrossel de séries" onViewAll={viewAll("Séries")} empty={!series.length && "Nenhuma série encontrada."}>
        {series.map((p) => (
          <PosterCard key={p.slug} post={p} badge={p.sub} badgeColor="#8BE04E" />
        ))}
      </Rail>

      <Rail id="livros" title="Livros" label="Carrossel de livros" onViewAll={viewAll("Livros")} empty={!books.length && "Nenhum livro encontrado."}>
        {books.map((p) => (
          <BookCard key={p.slug} post={p} />
        ))}
      </Rail>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex max-w-[1280px] flex-col items-center gap-2.5 px-[clamp(16px,5vw,64px)] pt-[72px] pb-10 text-center"
      >
        <h2 className="text-[clamp(32px,5vw,48px)] font-bold tracking-[-0.01em]">Leituras em Destaque</h2>
        <svg width="140" height="14" viewBox="0 0 140 14" aria-hidden>
          <motion.path
            d="M3 8c10-8 18 8 28 0s18 8 28 0 18 8 28 0 18 8 28 0 14 6 22 0"
            stroke="#FF5A36"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: "easeInOut", delay: 0.2 }}
          />
        </svg>
      </motion.div>

      <BookFeature posts={data.bookFeatures} />

      <Rail id="noticias" title="Últimas notícias" label="Carrossel de notícias" onViewAll={viewAll("Notícias")} empty={!news.length && "Nenhuma notícia encontrada."}>
        {news.map((p) => (
          <NewsCard key={p.slug} post={p} />
        ))}
      </Rail>

      <WatchNext />

      <DopaIndica film={data.picks.film} book={data.picks.book} />
      <Newsletter />
    </motion.main>
  )
}
