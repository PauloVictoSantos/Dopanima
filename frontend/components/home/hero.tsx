"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"
import { Pause, Play } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { AuthorAvatar, SaveButton } from "@/components/brand"
import { TYPE_META, coverBg, type Post } from "@/lib/posts"
import { cn } from "@/lib/utils"

const SLIDE_MS = 6000
const TICK_MS = 100
const EASE = [0.22, 1, 0.36, 1] as const

const stagger = { show: { transition: { staggerChildren: 0.08 } } }
const rise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
}

export function Hero({ posts: HERO }: { posts: Post[] }) {
  const [{ idx, elapsed }, setSlide] = useState({ idx: 0, elapsed: 0 })
  const [hover, setHover] = useState(false)
  const [stopped, setStopped] = useState(false)
  const reduce = useReducedMotion()
  const paused = hover || stopped || !!reduce

  useEffect(() => {
    if (paused) return
    const t = setInterval(() => {
      setSlide((s) =>
        s.elapsed + TICK_MS < SLIDE_MS
          ? { idx: s.idx, elapsed: s.elapsed + TICK_MS }
          : { idx: (s.idx + 1) % HERO.length, elapsed: 0 }
      )
    }, TICK_MS)
    return () => clearInterval(t)
  }, [paused, HERO.length])

  const { scrollY } = useScroll()
  const artY = useTransform(scrollY, (y) => Math.min(y * 0.35, 120))
  const textY = useTransform(scrollY, (y) => Math.min(y * 0.12, 50))

  const hero = HERO[idx] ?? HERO[0]
  const meta = TYPE_META[hero.type]
  const select = (i: number) => setSlide({ idx: i, elapsed: 0 })

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Posts em destaque"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="relative isolate flex min-h-[680px] flex-col justify-end overflow-hidden"
    >
      <motion.div aria-hidden className="absolute inset-x-0 -top-[130px] bottom-0 -z-20" style={{ y: artY }}>
        {HERO.map((p, i) => (
          <motion.div
            key={p.slug}
            className="absolute inset-0"
            style={{ background: coverBg(p) }}
            initial={false}
            animate={{ opacity: i === idx ? 1 : 0, scale: i === idx ? 1 : 1.04 }}
            transition={{ duration: 0.9, ease: EASE }}
          />
        ))}
      </motion.div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10" style={{ background: "linear-gradient(90deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.25) 35%,rgba(0,0,0,0) 60%),linear-gradient(0deg,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 30%)" }}
      />
      <svg aria-hidden width="120" height="40" viewBox="0 0 120 40" className="absolute top-[18%] right-[8%] opacity-50">
        <path d="M4 30c14-22 26 10 40-8s22 12 36-6 22 8 36-10" stroke="#F7E27A" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>

      <motion.div style={{ y: textY }} className="mx-auto w-full max-w-[1280px] px-[clamp(16px,5vw,64px)] pt-[120px] pb-[150px] sm:pb-[200px]">
        <motion.div key={hero.slug} variants={stagger} initial="hidden" animate="show" className="flex max-w-[580px] flex-col items-start gap-3.5">
          <motion.span
            variants={rise}
            className="inline-flex h-7 items-center rounded-full px-3.5 text-xs font-semibold tracking-[0.06em] text-dp-bg uppercase"
            style={{ background: meta.color }}
          >
            {meta.label} · {hero.sub}
          </motion.span>
          <motion.h1 variants={rise} className="font-display text-[clamp(40px,6vw,72px)] leading-[0.98] font-normal tracking-[0.01em] text-balance">
            {hero.title}
          </motion.h1>
          <motion.div variants={rise} className="flex flex-wrap items-baseline gap-3">
            <span className="text-[17px] font-medium">{hero.subtitle}</span>
            <span className="text-[13px] font-semibold text-dp-green">{hero.dateLabel}</span>
          </motion.div>
          <motion.p variants={rise} className="line-clamp-3 max-w-[480px] text-sm leading-relaxed text-dp-muted">
            {hero.excerpt}
          </motion.p>
          <motion.div variants={rise} className="flex items-center gap-2.5 text-[13px] text-dp-muted">
            <AuthorAvatar author={hero.author} />
            <span className="font-medium text-white">{hero.author.name}</span>
            <span aria-hidden>·</span>
            <span>{hero.readTime} de leitura</span>
          </motion.div>
          <motion.div variants={rise} className="mt-2 flex items-center gap-3">
            <Link href={`/post/${hero.slug}`} className={buttonVariants({ variant: "brand", size: "pill" })}>
              Ler post
            </Link>
            <SaveButton slug={hero.slug} />
          </motion.div>
        </motion.div>
      </motion.div>

      <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3.5 px-4">
        <div className="flex max-w-full items-end gap-2.5">
          {HERO.map((p, i) => {
            const active = i === idx
            return (
              <motion.button
                key={p.slug}
                onClick={() => select(i)}
                aria-label={`Destaque ${i + 1}: ${p.title}`}
                aria-current={active ? "true" : undefined}
                initial={false}
                animate={{ opacity: active ? 1 : 0.55 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
                className={cn(
                  "shrink-0 cursor-pointer rounded-xl border-2 p-0 transition-[width,height,border-color] duration-500 ease-dp",
                  active
                    ? "h-[47px] w-[76px] border-white/90 sm:h-[93px] sm:w-[150px]"
                    : "h-[35px] w-14 border-white/15 sm:h-[68px] sm:w-[110px]"
                )}
                style={{ background: coverBg(p) }}
              />
            )
          })}
        </div>
        <div className="flex h-[13px] items-center gap-2">
          {HERO.map((p, i) => {
            const fill = i < idx ? 1 : i === idx ? (paused ? 1 : elapsed / SLIDE_MS) : 0
            return (
              <button key={p.slug} onClick={() => select(i)} aria-label={`Destaque ${i + 1}: ${p.title}`} className="flex h-2 w-2.5 cursor-pointer items-center">
                <span className="relative block h-[3px] w-full overflow-hidden rounded-xs bg-white/30">
                  <span className="absolute inset-0 origin-left bg-dp-yellow transition-transform duration-100 ease-linear" style={{ transform: `scaleX(${fill})` }} />
                </span>
              </button>
            )
          })}
          <button
            onClick={() => setStopped((s) => !s)}
            aria-label={stopped ? "Retomar troca automática" : "Pausar troca automática"}
            className="ml-1.5 grid size-7 cursor-pointer place-items-center rounded-full border border-white/40 bg-dp-bg/40 text-white"
          >
            {stopped ? <Play className="size-2.5" fill="currentColor" /> : <Pause className="size-2.5" fill="currentColor" />}
          </button>
        </div>
      </div>
    </section>
  )
}
