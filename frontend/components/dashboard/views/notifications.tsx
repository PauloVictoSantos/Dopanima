"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Calendar, FileText, Info, MessageSquare, Search, TriangleAlert, Users, type LucideIcon } from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { PageHeading, PageMain, Panel, PillTabs, SwitchRow, btnOutline, btnPrimary } from "@/components/dashboard/ui"
import { NOTIF_META, type DashNotif, type NotifGroup, type NotifPrefs, type NotifType } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

const ICON: Record<NotifType, LucideIcon> = {
  comment: MessageSquare,
  spam: TriangleAlert,
  post: FileText,
  sched: Calendar,
  system: Info,
  seo: Search,
  user: Users,
}

type Tab = "all" | "unread" | NotifGroup
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "Não lidas" },
  { key: "comment", label: "Comentários" },
  { key: "post", label: "Posts" },
  { key: "system", label: "Sistema" },
]

const PREFS: [keyof NotifPrefs, string, string][] = [
  ["comments", "Comentários", "Novos comentários e spam detectado"],
  ["review", "Posts em revisão", "Quando alguém envia um post para revisar"],
  ["sched", "Agendamentos", "Quando um post agendado vai ao ar"],
  ["system", "Alertas do sistema", "Backup, SEO, mídia e segurança"],
  ["weekly", "Resumo por e-mail", "Um e-mail toda segunda com a semana"],
]

const small = "h-7.5 shrink-0 cursor-pointer rounded-full border px-3.5 text-xs font-semibold whitespace-nowrap"

export function NotificationsView() {
  const router = useRouter()
  const { notifs, setNotifs, unreadCount, notifPrefs, setNotifPrefs } = useDashboard()
  const [tab, setTab] = useState<Tab>("all")

  const inTab = (n: DashNotif, k: Tab) => k === "all" || (k === "unread" ? n.unread : NOTIF_META[n.type].group === k)
  const items = notifs.filter((n) => inTab(n, tab))
  const update = (id: number, patch: Partial<DashNotif>) => setNotifs((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)))

  return (
    <PageMain className="max-w-[1200px]">
      <PageHeading eyebrow={unreadCount ? `${unreadCount} não lidas` : "Tudo em dia"} title="Notificações">
        <button
          onClick={() => {
            setNotifs((ns) => ns.filter((n) => n.unread))
            toast.success("Notificações lidas removidas")
          }}
          className={btnOutline}
        >
          Limpar lidas
        </button>
        <button
          onClick={() => {
            setNotifs((ns) => ns.map((n) => ({ ...n, unread: false })))
            toast.success("Todas marcadas como lidas")
          }}
          className={btnPrimary + " tracking-[0.06em]"}
        >
          Marcar todas como lidas
        </button>
      </PageHeading>

      <PillTabs label="Filtrar notificações" active={tab} onSelect={setTab} items={TABS.map((t) => ({ ...t, count: notifs.filter((n) => inTab(n, t.key)).length }))} />

      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[2_1_520px] flex-col gap-2.5">
          {items.map((n) => {
            const { color } = NOTIF_META[n.type]
            const Icon = ICON[n.type]
            return (
              <article
                key={n.id}
                className={cn(
                  "flex items-start gap-3.5 rounded-[14px] border px-4 py-3.5 transition-colors",
                  n.unread ? "border-dp-yellow/30 bg-dp-yellow/5" : "border-white/8 bg-white/3"
                )}
              >
                <span className="grid size-9.5 shrink-0 place-items-center rounded-full" style={{ background: color + "22", color }}>
                  <Icon className="size-4.25" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className={cn("text-sm", n.unread ? "font-bold" : "font-medium")}>{n.title}</span>
                    <span className="shrink-0 text-xs whitespace-nowrap text-[#9C8AA6]">{n.time}</span>
                  </div>
                  <span className="text-[13px] leading-normal text-dp-muted">{n.desc}</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {n.href && (
                      <button
                        onClick={() => {
                          update(n.id, { unread: false })
                          router.push(n.href)
                        }}
                        className={cn(small, "border-dp-yellow text-dp-yellow hover:bg-dp-yellow/10")}
                      >
                        Abrir
                      </button>
                    )}
                    <button onClick={() => update(n.id, { unread: !n.unread })} className={cn(small, "border-white/30 text-white hover:border-white")}>
                      {n.unread ? "Marcar como lida" : "Marcar como não lida"}
                    </button>
                    <button
                      onClick={() => setNotifs((ns) => ns.filter((x) => x.id !== n.id))}
                      className={cn(small, "border-[#FF8A73]/45 text-[#FF8A73] hover:bg-[#FF8A73]/10")}
                    >
                      Remover
                    </button>
                  </div>
                </div>
                {n.unread && <span role="img" aria-label="Não lida" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-dp-orange" />}
              </article>
            )
          })}
          {!items.length && <p className="m-0 rounded-2xl border border-dashed border-white/20 p-6 text-[13px] text-dp-muted">Nenhuma notificação aqui.</p>}
        </section>

        <Panel className="flex-[1_1_300px] gap-1">
          <h2 className="m-0 mb-1.5 text-base font-semibold">O que me avisar</h2>
          {PREFS.map(([key, label, desc]) => (
            <SwitchRow key={key} label={label} desc={desc} on={notifPrefs[key]} onToggle={() => setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))} />
          ))}
        </Panel>
      </div>
    </PageMain>
  )
}
