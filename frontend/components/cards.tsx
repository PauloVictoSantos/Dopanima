"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { TypeBadge } from "@/components/brand"
import { bookBg, coverBg, type Post } from "@/lib/posts"

const EASE = [0.22, 1, 0.36, 1] as const
const MotionLink = motion.create(Link)

const hoverCard = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.35, ease: EASE },
}

function ReadOverlay({ align = "start" }: { align?: "start" | "end" }) {
  return (
    <div
      className={`absolute inset-0 flex items-end bg-linear-to-t from-black/60 to-transparent to-60% p-3 opacity-0 transition-opacity duration-250 group-hover:opacity-100 ${align === "end" ? "justify-end" : ""}`}
    >
      <span className="inline-flex h-[30px] items-center rounded-full bg-dp-yellow px-3.5 text-xs font-semibold text-dp-bg">Ler →</span>
    </div>
  )
}

const POSTER_W = "w-[calc((100vw-48px)/2)] sm:w-[200px]"

/** 2:3 poster card used by the recent, film and series rails. */
export function PosterCard({
  post,
  badge,
  badgeColor,
  index = 0,
}: {
  post: Post
  badge?: string
  badgeColor?: string
  index?: number
}) {
  return (
    <MotionLink
      href={`/post/${post.slug}`}
      draggable={false}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index, 8) * 0.06 }}
      whileHover={hoverCard.whileHover}
      whileTap={hoverCard.whileTap}
      className={`group flex shrink-0 snap-start flex-col gap-2.5 text-white ${POSTER_W}`}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-xl border border-white/12" style={{ background: coverBg(post) }}>
        <TypeBadge post={post} label={badge} color={badgeColor} className="absolute top-2.5 left-2.5" />
        <ReadOverlay />
      </div>
      <span className="line-clamp-2 text-center text-[15px] leading-[1.35] font-semibold">{post.title}</span>
      <span className="text-center text-xs text-dp-muted">
        {post.author.name} · {post.dateLabel} · {post.readTime}
      </span>
    </MotionLink>
  )
}

/** A book cover: the real image, or a typographic gradient with a spine. */
export function BookCover({ post, big }: { post: Post; big?: boolean }) {
  return (
    <>
      <span className={`absolute inset-y-0 left-0 bg-dp-bg/35 ${big ? "w-2.5" : "w-2"}`} />
      {!post.real && (
        <>
          <span
            className={`absolute font-display leading-[1.05] text-balance text-white [text-shadow:0_1px_0_rgba(26,5,34,.4)] ${big ? "top-[22px] right-4 left-[22px] text-[clamp(20px,2.4vw,28px)]" : "top-[18px] right-3.5 left-[18px] text-xl"}`}
          >
            {post.book}
          </span>
          <span className={`absolute text-xs font-semibold text-white ${big ? "bottom-[18px] left-[22px]" : "bottom-3.5 left-[18px]"}`}>{post.bookAuthor}</span>
        </>
      )}
    </>
  )
}

export function BookCard({ post }: { post: Post }) {
  return (
    <MotionLink
      href={`/post/${post.slug}`}
      draggable={false}
      {...hoverCard}
      className={`group flex shrink-0 snap-start flex-col gap-2 text-white ${POSTER_W}`}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-xl border border-white/14" style={{ background: bookBg(post) }}>
        <BookCover post={post} />
        <ReadOverlay align="end" />
      </div>
      <span className="line-clamp-2 text-[13px] leading-[1.35] font-semibold">{post.title}</span>
      <span className="text-xs text-dp-muted">
        {post.book} · {post.bookAuthor}
      </span>
    </MotionLink>
  )
}

export function NewsCard({ post }: { post: Post }) {
  return (
    <MotionLink
      href={`/post/${post.slug}`}
      draggable={false}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="flex w-[calc(100vw-48px)] shrink-0 snap-start gap-3.5 rounded-2xl border border-white/12 bg-white/3 p-2.5 text-white transition-colors hover:border-white/35 sm:w-[420px]"
    >
      <div className="aspect-16/10 w-2/5 shrink-0 rounded-xl" style={{ background: coverBg(post) }} />
      <div className="flex min-w-0 flex-col gap-1.5 py-0.5">
        <span className="flex items-center gap-2 text-xs">
          <TypeBadge label={post.sub} color="#C9A0E0" className="h-[22px] px-2" />
          <span className="text-dp-muted">{post.dateLabel}</span>
        </span>
        <span className="line-clamp-3 text-sm leading-[1.35] font-semibold">{post.title}</span>
        <span className="mt-auto text-xs text-dp-muted">{post.readTime} de leitura</span>
      </div>
    </MotionLink>
  )
}

/** Grid card used for related posts on the article page. */
export function RelatedCard({ post }: { post: Post }) {
  return (
    <MotionLink href={`/post/${post.slug}`} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.35, ease: EASE }} className="flex flex-col gap-2.5 text-white">
      <div className="relative aspect-16/10 overflow-hidden rounded-xl border border-white/12" style={{ background: coverBg(post) }}>
        <TypeBadge post={post} className="absolute top-2.5 left-2.5" />
      </div>
      <span className="text-[15px] leading-[1.35] font-semibold">{post.title}</span>
      <span className="text-xs text-dp-muted">
        {post.author.name} · {post.dateLabel} · {post.readTime}
      </span>
    </MotionLink>
  )
}
