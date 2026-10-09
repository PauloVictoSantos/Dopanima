"use client"

import { useRef } from "react"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type RailProps = {
  id: string
  title: string
  label: string
  onViewAll: () => void
  empty?: string | false
  children: React.ReactNode
}

/** Section header + horizontally scrolling, snap-aligned track. */
export function Rail({ id, title, label, onViewAll, empty, children }: RailProps) {
  const track = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)

  const scrollBy = (dir: number) => {
    const el = track.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return
    const el = track.current
    if (!el) return
    const x0 = e.clientX
    const s0 = el.scrollLeft
    dragged.current = false
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0
      if (Math.abs(dx) > 5) {
        dragged.current = true
        el.style.scrollSnapType = "none"
        el.style.cursor = "grabbing"
      }
      el.scrollLeft = s0 - dx
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      el.style.cursor = ""
      if (dragged.current) {
        const w = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 16 : 300
        el.scrollTo({ left: Math.round(el.scrollLeft / w) * w, behavior: "smooth" })
        setTimeout(() => (el.style.scrollSnapType = ""), 400)
      }
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <section id={id} aria-labelledby={`h-${id}`} className="mx-auto max-w-[1280px] scroll-mt-20 px-[clamp(16px,5vw,64px)] pt-10">
      <div className="mb-1.5 flex items-center gap-3">
        <h2 id={`h-${id}`} className="mr-auto text-2xl font-bold">{title}</h2>
        <div className="hidden gap-3 lg:flex">
          <Button variant="ring" size="circle-sm" aria-label="Rolar para trás" onClick={() => scrollBy(-1)}>
            <ChevronLeft className="size-3.5" strokeWidth={2.5} />
          </Button>
          <Button variant="ring" size="circle-sm" aria-label="Rolar para frente" onClick={() => scrollBy(1)}>
            <ChevronRight className="size-3.5" strokeWidth={2.5} />
          </Button>
        </div>
        <button onClick={onViewAll} className="ml-2 flex cursor-pointer items-center gap-2 text-[13px] font-medium text-dp-muted hover:text-dp-yellow">
          Ver tudo
          <span className="grid size-[26px] place-items-center rounded-full border border-current">
            <ArrowRight className="size-3" strokeWidth={2.5} />
          </span>
        </button>
      </div>
      <div
        ref={track}
        tabIndex={0}
        aria-label={`${label}. Use as setas do teclado.`}
        onKeyDown={(e) => {
          const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0
          if (dir) {
            e.preventDefault()
            scrollBy(dir)
          }
        }}
        onPointerDown={onPointerDown}
        onClickCapture={(e) => {
          if (dragged.current) {
            e.preventDefault()
            e.stopPropagation()
            dragged.current = false
          }
        }}
        className="no-scrollbar -mx-2 flex cursor-grab snap-x snap-mandatory gap-4 overflow-x-auto px-2 pt-3 pb-4 select-none"
      >
        {children}
      </div>
      {empty && <p className="mt-2 text-sm text-dp-muted">{empty}</p>}
    </section>
  )
}
