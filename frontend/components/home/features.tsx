"use client"

import Link from "next/link"
import { useState } from "react"
import { motion } from "motion/react"
import { buttonVariants } from "@/components/ui/button"
import { AuthorAvatar, SaveButton, TornEdge } from "@/components/brand"
import { BookCover } from "@/components/cards"
import { bookBg, coverBg, type Post } from "@/lib/posts"
import { cn } from "@/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const
const slideIn = (delay = 0) => ({
  initial: { opacity: 0, x: -32 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.6, ease: EASE, delay },
})

function ReadActions({ post, label }: { post: Post; label: string }) {
  return (
    <div className="mt-2.5 flex items-center gap-3">
      <Link href={`/post/${post.slug}`} className={buttonVariants({ variant: "brand", size: "pill" })}>
        {label}
      </Link>
      <SaveButton slug={post.slug} />
    </div>
  )
}

export function FilmFeature({ posts: FILM_FEATURES }: { posts: Post[] }) {
  const [idx, setIdx] = useState(0)
  const film = FILM_FEATURES[idx]
  if (!film) return null
  return (
    <section aria-label="Resenha de filme em destaque" className="relative isolate mt-14 flex min-h-[560px] items-center overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-20">
        {FILM_FEATURES.map((p, i) => (
          <motion.div
            key={p.slug}
            className="absolute inset-0"
            style={{ background: coverBg(p) }}
            initial={false}
            animate={{ opacity: i === idx ? 1 : 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        ))}
      </div>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "linear-gradient(90deg,rgba(0,0,0,.6) 0%,rgba(0,0,0,.3) 40%,rgba(0,0,0,0) 70%)" }} />
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-10 px-[clamp(16px,5vw,64px)] pt-[72px] pb-[88px]">
        <div className="flex max-w-[600px] flex-[1_1_420px] flex-col items-start gap-3.5">
          <span className="text-xs font-semibold tracking-[0.14em] text-dp-orange uppercase">Resenha de filme</span>
          <div key={film.slug} className="flex flex-col items-start gap-3.5">
            <motion.h2 {...slideIn()} className="font-display text-[clamp(40px,6vw,72px)] leading-[0.98] font-normal text-balance">
              {film.title}
            </motion.h2>
            <motion.p {...slideIn(0.08)} className="max-w-[480px] text-sm leading-relaxed text-dp-muted">
              {film.excerpt}
            </motion.p>
          </div>
          <div className="flex items-center gap-2.5 text-[13px] text-dp-muted">
            <AuthorAvatar author={film.author} />
            <span className="font-medium text-white">{film.author.name}</span>
            <span aria-hidden>·</span>
            <span>{film.readTime} de leitura</span>
          </div>
          <ReadActions post={film} label="Ler resenha" />
        </div>
        <div role="tablist" aria-label="Outras resenhas de filme" className="flex min-w-[240px] flex-[0_1_280px] flex-col gap-3.5">
          {FILM_FEATURES.map((p, i) => (
            <motion.button
              key={p.slug}
              role="tab"
              aria-selected={i === idx}
              aria-label={p.title}
              onClick={() => setIdx(i)}
              initial={false}
              animate={{ opacity: i === idx ? 1 : 0.6 }}
              whileHover={{ opacity: 1, filter: "brightness(1.15)" }}
              className={cn(
                "relative h-[127px] w-full max-w-[275px] cursor-pointer overflow-hidden rounded-2xl border-2 p-0 transition-colors",
                i === idx ? "border-white/90" : "border-white/12"
              )}
              style={{ background: coverBg(p) }}
            />
          ))}
        </div>
      </div>
      <TornEdge tint="#C9A0E0" tintOpacity={0.3} />
    </section>
  )
}

export function BookFeature({ posts: BOOK_FEATURES }: { posts: Post[] }) {
  const [idx, setIdx] = useState(0)
  const book = BOOK_FEATURES[idx]
  if (!book) return null
  return (
    <section
      aria-label="Resenha de livro em destaque"
      className="relative isolate flex min-h-[560px] items-center overflow-hidden bg-[linear-gradient(135deg,#2A0A12_0%,#1A0A1F_100%)]"
    >
      <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-10 px-[clamp(16px,5vw,64px)] pt-[72px] pb-[88px]">
        <div className="flex flex-[1_1_520px] flex-wrap items-center gap-10">
          <motion.div
            key={book.slug}
            initial={{ opacity: 0, rotate: -10, y: 20 }}
            animate={{ opacity: 1, rotate: -4, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative aspect-2/3 w-[clamp(150px,22vw,230px)] shrink-0 overflow-hidden rounded-xl border border-white/25"
            style={{ background: bookBg(book) }}
          >
            <BookCover post={book} big />
          </motion.div>
          <div className="flex max-w-[520px] flex-[1_1_300px] flex-col items-start gap-3.5">
            <span className="text-xs font-semibold tracking-[0.14em] text-dp-yellow uppercase">Resenha de livro</span>
            <div key={book.slug} className="flex flex-col items-start gap-3.5">
              <motion.h2 {...slideIn(0.06)} className="font-display text-[clamp(40px,5vw,64px)] leading-[0.98] font-normal text-balance">
                {book.title}
              </motion.h2>
              <span className="text-sm font-medium text-dp-lilac">
                de {book.bookAuthor} · resenha por {book.author.name}
              </span>
              <motion.p {...slideIn(0.12)} className="text-sm leading-relaxed text-dp-muted">
                {book.excerpt}
              </motion.p>
            </div>
            <ReadActions post={book} label="Ler resenha" />
          </div>
        </div>
        <div role="tablist" aria-label="Outras resenhas de livro" className="flex min-w-[240px] flex-[0_1_300px] flex-col gap-3">
          {BOOK_FEATURES.map((p, i) => (
            <motion.button
              key={p.slug}
              role="tab"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              initial={false}
              animate={{ opacity: i === idx ? 1 : 0.5 }}
              whileHover={{ opacity: 1, filter: "brightness(1.15)" }}
              className={cn(
                "flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 bg-white/4 p-2.5 text-left text-white transition-colors",
                i === idx ? "border-white/90" : "border-white/8"
              )}
            >
              <span className="aspect-2/3 w-[52px] shrink-0 rounded-lg" style={{ background: bookBg(p) }} />
              <span className="flex flex-col gap-1">
                <span className="text-sm leading-[1.3] font-semibold">{p.title}</span>
                <span className="text-xs text-dp-muted">{p.bookAuthor}</span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>
      <TornEdge tint="#F7E27A" tintOpacity={0.22} />
    </section>
  )
}
