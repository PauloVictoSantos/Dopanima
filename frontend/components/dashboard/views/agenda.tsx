"use client"

import Link from "next/link"
import { useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Empty, PageHeading, PageMain, Panel, Thumb, btnPrimary } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { postsApi } from "@/lib/dashboard-api"
import { fmtDate, todayIso } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

// The sample calendar covers October 2026, where all the scheduled posts live.
const YEAR = 2026
const MONTH = 10
const DAYS = new Date(YEAR, MONTH, 0).getDate()
const LEAD = new Date(YEAR, MONTH - 1, 1).getDay()
const iso = (d: number) => `${YEAR}-${String(MONTH).padStart(2, "0")}-${String(d).padStart(2, "0")}`
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const noop = () => () => {}

export function AgendaView() {
  const { posts, reloadPosts } = useDashboard()
  const today = useSyncExternalStore(noop, todayIso, () => "")
  const [day, setDay] = useState(10)

  const scheduled = posts
    .filter((p) => p.status === "Agendado" && p.sched)
    .sort((a, b) => (a.sched!.date + a.sched!.time).localeCompare(b.sched!.date + b.sched!.time))
  const published = posts.filter((p) => p.status === "Publicado")

  const itemsOn = (d: number) => [
    ...scheduled.filter((p) => p.sched!.date === iso(d)).map((p) => ({ p, label: `${p.sched!.time} ${p.title}`, meta: `Agendado · ${p.sched!.time} · ${p.author}`, sched: true })),
    ...published.filter((p) => p.date === iso(d)).map((p) => ({ p, label: p.title, meta: `Publicado · ${p.author}`, sched: false })),
  ]
  const dayItems = itemsOn(day)
  const cells: (number | null)[] = [...Array(LEAD).fill(null), ...Array.from({ length: DAYS }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)

  const run = async (task: () => Promise<unknown>, msg?: string) => {
    try {
      await task()
      await reloadPosts()
      if (msg) toast.success(msg)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  const reschedule = (id: number, date: string, time: string) =>
    run(() => postsApi.update(id, { status: "scheduled", scheduleDate: date, scheduleTime: time }), "Agendamento atualizado")

  return (
    <PageMain>
      <PageHeading eyebrow="Calendário editorial · fuso America/Manaus" title="Agendamento">
        <Link href="/painel/posts/novo" className={btnPrimary + " no-underline"}>+ Agendar post</Link>
      </PageHeading>

      <div className="flex flex-wrap items-start gap-5">
        <Panel className="flex-[2_1_600px] gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-bold">Outubro 2026</h2>
            <div className="flex gap-3.5 text-xs text-dp-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-dp-yellow" />Agendado</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-dp-green/50" />Publicado</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-[#9C8AA6]">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              if (d == null) return <span key={"e" + i} aria-hidden />
              const items = itemsOn(d)
              const sel = d === day
              const isToday = iso(d) === today
              return (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  aria-label={`${d} de outubro, ${items.length} posts`}
                  aria-pressed={sel}
                  className={cn(
                    "flex min-h-24 min-w-0 cursor-pointer flex-col gap-1 rounded-xl p-2 text-left text-white",
                    sel ? "border-2 border-dp-yellow bg-dp-yellow/8" : isToday ? "border border-dp-orange bg-white/2" : "border border-white/8 bg-white/2"
                  )}
                >
                  <span className={cn("text-[13px]", isToday ? "font-bold text-dp-orange" : "font-medium")}>{d}</span>
                  {items.slice(0, 3).map((it) => (
                    <span
                      key={it.p.id}
                      className={cn("block truncate rounded-md px-1.5 py-[3px] text-[11px] font-semibold", it.sched ? "bg-dp-yellow text-dp-bg" : "bg-dp-green/22 text-[#CFF3B4]")}
                    >
                      {it.label}
                    </span>
                  ))}
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel className="flex-[1_1_320px] gap-3">
          <h2 className="m-0 text-base font-semibold">{day} de outubro</h2>
          {dayItems.map((it) => (
            <div key={it.p.id} className="flex items-center gap-2.5 rounded-xl bg-white/4 p-2.5">
              <Thumb url={it.p.img} className="h-12.5 w-9 rounded-md border-0" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{it.p.title}</span>
                <span className="text-xs text-dp-muted">{it.meta}</span>
              </span>
            </div>
          ))}
          {!dayItems.length && <Empty>Nada programado neste dia.</Empty>}

          <h2 className="m-0 mt-3 border-t border-white/8 pt-3.5 text-base font-semibold">Fila de publicação</h2>
          {scheduled.map((p) => (
            <div key={p.id} className="flex flex-col gap-2.5 rounded-xl border border-white/10 p-3">
              <div className="flex items-start gap-2.5">
                <Thumb url={p.img} className="h-12.5 w-9 rounded-md border-0" />
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-[13px] font-semibold">{p.title}</span>
                  <span className="text-xs text-dp-yellow">{fmtDate(p.sched!.date)} às {p.sched!.time} · America/Manaus</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="date"
                  value={p.sched!.date}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    reschedule(p.id, v, p.sched!.time)
                    toast.success("Reagendado para " + fmtDate(v))
                  }}
                  aria-label="Reagendar data"
                  className="h-8.5 min-w-0 rounded-lg border border-white/18 bg-white/4 px-2 text-xs text-white scheme-dark"
                />
                <input
                  type="time"
                  value={p.sched!.time}
                  onChange={(e) => e.target.value && reschedule(p.id, p.sched!.date, e.target.value)}
                  aria-label="Alterar horário"
                  className="h-8.5 min-w-0 rounded-lg border border-white/18 bg-white/4 px-2 text-xs text-white scheme-dark"
                />
              </div>
              <div className="flex gap-1.5">
                <Link href={`/painel/posts/${p.id}`} className="grid h-8 flex-1 place-items-center rounded-full border border-white/25 text-xs font-semibold text-white no-underline hover:border-dp-yellow hover:text-dp-yellow">
                  Editar
                </Link>
                <button
                  onClick={() => run(() => postsApi.setStatus(p.id, "Rascunho"), "Publicação cancelada, post voltou para rascunho")}
                  className="h-8 flex-1 cursor-pointer rounded-full border border-[#FF8A73]/50 text-xs font-semibold whitespace-nowrap text-[#FF8A73] hover:bg-[#FF8A73]/10"
                >
                  Cancelar publicação
                </button>
              </div>
            </div>
          ))}
          {!scheduled.length && <Empty>Nenhum post agendado.</Empty>}
        </Panel>
      </div>
    </PageMain>
  )
}
