"use client"

import { motion } from "motion/react"
import { Bookmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSite } from "@/components/site-provider"
import { TYPE_META, type Author, type Post } from "@/lib/posts"

export function Logo({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("logo-mark flex flex-col", className)} style={{ fontSize: size }}>
      <span>Dopa</span>
      <span style={{ paddingLeft: size * 0.54 }}>Nima</span>
    </span>
  )
}

export function AuthorAvatar({ author, size = 28 }: { author: Author; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border border-white/40 font-semibold text-white"
      style={{ width: size, height: size, background: author.color, fontSize: size * 0.39 }}
    >
      {author.initials}
    </span>
  )
}

export function TypeBadge({ post, label, color, className }: { post?: Post; label?: string; color?: string; className?: string }) {
  const meta = post ? TYPE_META[post.type] : null
  return (
    <span
      className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold text-dp-bg", className)}
      style={{ background: color ?? meta?.color }}
    >
      {label ?? meta?.label}
    </span>
  )
}

export function SaveButton({ slug, className, small }: { slug: string; className?: string; small?: boolean }) {
  const { isSaved, toggleSave } = useSite()
  const saved = isSaved(slug)
  return (
    <Button
      variant="glass"
      size={small ? "icon-lg" : "circle"}
      onClick={() => toggleSave(slug)}
      aria-label={saved ? "Remover dos salvos" : "Salvar post"}
      aria-pressed={saved}
      className={cn(small && "size-10 rounded-full", saved ? "text-dp-yellow" : "text-white", className)}
    >
      <motion.span key={String(saved)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
        <Bookmark className="size-[18px]" fill={saved ? "currentColor" : "none"} />
      </motion.span>
    </Button>
  )
}

/** Dopa: the hexagon mascot holding a clapperboard. */
export function Mascot({ size = 170 }: { size?: number }) {
  return (
    <motion.svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label="Mascote Dopa: um hexágono laranja sorridente com luvas amarelas segurando uma claquete"
      animate={{ y: [-6, 6, -6] }}
      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
    >
      <g transform="translate(118 112) rotate(-10)">
        <rect x="0" y="12" width="64" height="44" rx="6" fill="#1A0522" stroke="#5A0F6E" strokeWidth="4" />
        <path d="M0 12 L4 -4 L68 6 L64 12 Z" fill="#fff" stroke="#5A0F6E" strokeWidth="4" strokeLinejoin="round" />
        <path d="M16 -1 L12 10 M32 1 L28 12 M48 4 L44 13" stroke="#1A0522" strokeWidth="5" />
        <path d="M10 30h40M10 42h28" stroke="#C9A0E0" strokeWidth="4" strokeLinecap="round" />
      </g>
      <path d="M100 20 L166 58 L166 134 L100 172 L34 134 L34 58 Z" fill="#FF8A3D" stroke="#5A0F6E" strokeWidth="6" strokeLinejoin="round" />
      <path d="M100 32 L156 64 L156 82" stroke="#FFB07A" strokeWidth="6" fill="none" strokeLinecap="round" />
      <ellipse cx="80" cy="92" rx="9" ry="12" fill="#1A0522" />
      <ellipse cx="120" cy="92" rx="9" ry="12" fill="#1A0522" />
      <circle cx="83" cy="88" r="3" fill="#fff" />
      <circle cx="123" cy="88" r="3" fill="#fff" />
      <circle cx="66" cy="114" r="8" fill="#FF5A36" opacity=".5" />
      <circle cx="134" cy="114" r="8" fill="#FF5A36" opacity=".5" />
      <path d="M84 116 Q100 132 116 116" stroke="#1A0522" strokeWidth="6" fill="none" strokeLinecap="round" />
      <motion.g
        style={{ originX: "34px", originY: "120px" }}
        animate={{ rotate: [0, 0, -24, 8, -16, 0] }}
        transition={{ duration: 3, times: [0, 0.55, 0.65, 0.75, 0.85, 1], repeat: Infinity, delay: 1 }}
      >
        <path d="M34 120 Q16 100 14 76" stroke="#5A0F6E" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="14" cy="68" r="13" fill="#F7E27A" stroke="#5A0F6E" strokeWidth="5" />
      </motion.g>
      <circle cx="146" cy="140" r="13" fill="#F7E27A" stroke="#5A0F6E" strokeWidth="5" />
    </motion.svg>
  )
}

export function MiniMascot() {
  return (
    <motion.svg
      width="48"
      height="48"
      viewBox="0 0 200 200"
      aria-hidden="true"
      animate={{ y: [-6, 6, -6] }}
      transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
    >
      <path d="M100 20 L166 58 L166 134 L100 172 L34 134 L34 58 Z" fill="#FF8A3D" stroke="#5A0F6E" strokeWidth="8" strokeLinejoin="round" />
      <ellipse cx="80" cy="92" rx="10" ry="13" fill="#1A0522" />
      <ellipse cx="120" cy="92" rx="10" ry="13" fill="#1A0522" />
      <path d="M82 118 Q100 134 118 118" stroke="#1A0522" strokeWidth="8" fill="none" strokeLinecap="round" />
    </motion.svg>
  )
}

/** Torn-paper edge used at the bottom of feature bands. */
export function TornEdge({ tint, tintOpacity }: { tint: string; tintOpacity: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 1146 40" preserveAspectRatio="none" className="absolute bottom-[-1px] left-0 h-[34px] w-full">
      <path d="M0 40V12l40 6 38-12 46 8 30-10 52 14 34-8 48 10 40-14 44 12 36-6 50 10 42-12 38 8 46-10 34 12 52-8 40 10 44-14 38 10 50-6 36 8 48-12 40 10 46-8 38 12 44-10 52 8V40z" fill={tint} fillOpacity={tintOpacity} />
      <path d="M0 40V20l40 8 38-14 46 10 30-12 52 16 34-10 48 12 40-16 44 14 36-8 50 12 42-14 38 10 46-12 34 14 52-10 40 12 44-16 38 12 50-8 36 10 48-14 40 12 46-10 38 14 44-12 52 10V40z" fill="#1A0522" />
    </svg>
  )
}
