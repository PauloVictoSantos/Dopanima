"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, useScroll, useSpring } from "motion/react"
import { ArrowLeft, Link2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InstagramIcon, WhatsAppIcon, XIcon } from "@/components/icons"
import { trackView } from "@/lib/posts"

const EASE = [0.22, 1, 0.36, 1] as const

// Guards against the double effect run in dev (Strict Mode): one view per post per tab.
const tracked = new Set<string>()

/** Counts a view when the post opens (the API increments the post's counter). */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (tracked.has(slug)) return
    tracked.add(slug)
    trackView(slug)
  }, [slug])
  return null
}

export function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 })
  return <motion.div aria-hidden className="fixed inset-x-0 top-0 z-60 h-[3px] origin-left bg-dp-orange" style={{ scaleX }} />
}

export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

export function BackButton() {
  const router = useRouter()
  return (
    <Button
      variant="ring"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="mb-5 h-9 gap-2 bg-dp-bg/50 px-4 text-[13px] font-semibold"
    >
      <ArrowLeft className="size-3.5" strokeWidth={2.5} /> Voltar
    </Button>
  )
}

export function ShareBar({ title }: { title: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success("Link copiado")
    } catch {
      toast.error("Não foi possível copiar o link")
    }
  }
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer")
  const href = () => encodeURIComponent(window.location.href)

  const actions = [
    { label: "Copiar link", icon: <Link2 className="size-4" />, run: copy },
    { label: "Compartilhar no X", icon: <XIcon size={14} />, run: () => open(`https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${href()}`) },
    // Instagram has no web share endpoint; copying the link is the useful fallback.
    { label: "Compartilhar no Instagram", icon: <InstagramIcon size={16} />, run: copy },
    { label: "Compartilhar por WhatsApp", icon: <WhatsAppIcon />, run: () => open(`https://wa.me/?text=${encodeURIComponent(title + " ")}${href()}`) },
  ]

  return (
    <div className="mt-9 flex max-w-[720px] flex-wrap items-center gap-2.5 border-y border-white/12 py-4">
      <span className="mr-1.5 text-[13px] font-semibold">Compartilhar:</span>
      {actions.map((a) => (
        <motion.button
          key={a.label}
          onClick={a.run}
          aria-label={a.label}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          className="grid size-10 cursor-pointer place-items-center rounded-full border border-white/40 text-dp-yellow hover:bg-dp-yellow/12"
        >
          {a.icon}
        </motion.button>
      ))}
    </div>
  )
}
