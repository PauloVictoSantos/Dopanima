"use client"

import Link from "next/link"
import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mascot } from "@/components/brand"
import { bookBg, coverBg, type Post } from "@/lib/posts"

const EASE = [0.22, 1, 0.36, 1] as const

export function DopaIndica({ film, book }: { film: Post | null; book: Post | null }) {
  const picks = [
    ...(film ? [{ post: film, kind: "Filme", thumb: "w-24 aspect-16/10 rounded-[10px]", bg: coverBg(film), meta: film.subtitle }] : []),
    ...(book ? [{ post: book, kind: "Livro", thumb: "w-[54px] aspect-2/3 rounded-lg", bg: bookBg(book), meta: `de ${book.bookAuthor}` }] : []),
  ]
  return (
    <section id="indica" aria-labelledby="h-indica" className="relative mt-16 scroll-mt-20 overflow-hidden bg-dp-yellow text-dp-ink">
      <svg aria-hidden width="220" height="60" viewBox="0 0 220 60" className="absolute top-[18px] right-[4%] opacity-35">
        <path d="M4 40c20-30 40 14 60-8s36 18 56-6 34 16 50-4 26 10 46-10" stroke="#B5179E" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-10 px-[clamp(16px,5vw,64px)] py-12">
        <div className="w-[170px] shrink-0">
          <Mascot />
        </div>
        <div className="flex flex-[1_1_320px] flex-col gap-1.5">
          <span className="text-xs font-bold tracking-[0.14em] uppercase">Indicação do dia</span>
          <h2 id="h-indica" className="font-display text-[clamp(36px,4vw,48px)] leading-none font-normal text-dp-plum">
            Dopa Indica
          </h2>
          <p className="mt-1 max-w-[360px] text-sm leading-relaxed">Um filme e um livro escolhidos a dedo pela redação para hoje.</p>
        </div>
        <div className="grid flex-[2_1_480px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {picks.map(({ post, kind, thumb, bg, meta }, i) => (
            <motion.div
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link href={`/post/${post.slug}`} className="flex items-center gap-3.5 rounded-2xl border border-dp-ink/25 bg-dp-plum/8 p-3 text-dp-ink">
                <span className={`shrink-0 ${thumb}`} style={{ background: bg }} />
                <span className="flex flex-col gap-1">
                  <span className="text-xs font-bold tracking-[0.08em] text-dp-magenta uppercase">{kind}</span>
                  <span className="text-[15px] leading-[1.3] font-bold">{post.title}</span>
                  <span className="text-xs">{meta}</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function Newsletter() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setError("Digite um e-mail válido, tipo voce@exemplo.com")
      return
    }
    setEmail("")
    toast.success("Inscrição confirmada! Fique de olho na sua caixa de entrada.")
  }

  return (
    <section aria-labelledby="h-news" className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)] py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-white/15 bg-[linear-gradient(120deg,rgba(90,15,110,.55),rgba(181,23,158,.25))] px-[clamp(20px,4vw,48px)] py-9"
      >
        <div className="flex flex-[1_1_320px] flex-col gap-1.5">
          <h2 id="h-news" className="text-[clamp(24px,3vw,32px)] font-bold">Receba os posts no seu e-mail</h2>
          <p className="text-sm text-dp-muted">Uma vez por semana, sem spam. Filmes, livros e notícias em um só lugar.</p>
        </div>
        <form onSubmit={submit} noValidate className="flex flex-[1_1_380px] flex-col gap-1.5">
          <div className="flex flex-wrap gap-2.5">
            <Input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError("")
              }}
              placeholder="seu@email.com"
              aria-label="Seu e-mail"
              aria-invalid={!!error}
              className="h-11 flex-[1_1_220px] rounded-full border-white/40 bg-dp-bg/50 px-5 text-sm text-white focus-visible:border-dp-yellow"
            />
            <Button type="submit" variant="brand" className="h-11 px-8 text-[13px]">
              Assinar
            </Button>
          </div>
          <AnimatePresence>
            {error && (
              <motion.span
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pl-5 text-xs text-dp-yellow"
              >
                {error}
              </motion.span>
            )}
          </AnimatePresence>
        </form>
      </motion.div>
    </section>
  )
}
