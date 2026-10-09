"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { CircleCheck, CircleX, Eye, FileText, MessageSquare, MessagesSquare, TrendingUp, TriangleAlert, Users, type LucideIcon } from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Avatar, CatChip, Empty, PageMain, Panel, PillTabs, SectionTitle, SeoBadge, Thumb } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { KIND_LABEL, commentsApi, statsApi, type Overview, type SeoStatus } from "@/lib/dashboard-api"
import { fmtDate, initials, linePath, monthShort, nf } from "@/lib/dashboard"

const noop = () => () => {}

/** Today's date in long pt-BR form; empty on the server to avoid a hydration mismatch. */
function useLongDate() {
  return useSyncExternalStore(
    noop,
    () => {
      const s = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      return s.charAt(0).toUpperCase() + s.slice(1)
    },
    () => ""
  )
}

type Days = 7 | 30 | 90
const PERIODS: { key: Days; label: string; sub: string }[] = [
  { key: 7, label: "7 dias", sub: "vs. 7 dias anteriores" },
  { key: 30, label: "30 dias", sub: "vs. 30 dias anteriores" },
  { key: 90, label: "90 dias", sub: "vs. 90 dias anteriores" },
]

const STATUS_BAR: [string, string][] = [
  ["published", "Publicados"], ["draft", "Rascunhos"], ["scheduled", "Agendados"], ["review", "Em revisão"], ["archived", "Arquivados"],
]
const STATUS_BAR_COLOR: Record<string, string> = { published: "#8BE04E", draft: "#9C8AA6", scheduled: "#F7E27A", review: "#C9A0E0", archived: "#5A0F6E" }
const SOURCES: Record<string, [string, string]> = {
  busca: ["Busca orgânica", "#FF5A36"],
  social: ["Redes sociais", "#F7E27A"],
  direto: ["Direto", "#C9A0E0"],
  referencia: ["Outros sites", "#8BE04E"],
}
const ALERT_ICON: Record<SeoStatus, [LucideIcon, string]> = { good: [CircleCheck, "#8BE04E"], warning: [TriangleAlert, "#F7E27A"], error: [CircleX, "#FF8A73"] }

const fmtChange = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`

type SortTab = "top" | "comments" | "recent"

export function OverviewView() {
  const { posts, overviewQuery, can, reloadPending } = useDashboard()
  const [days, setDays] = useState<Days>(30)
  const [data, setData] = useState<Overview | null>(null)
  const [tab, setTab] = useState<SortTab>("top")
  const [hover, setHover] = useState<number | null>(null)
  const longDate = useLongDate()

  const load = useCallback(async () => {
    try {
      setData(await statsApi.overview(days))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }, [days])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from the API; state is set after it resolves
    void load()
  }, [load])

  const P = PERIODS.find((p) => p.key === days)!
  const series = data?.views.series ?? []
  const values = series.map((d) => d.views)
  const max = Math.max(1, ...values) * 1.15
  const line = values.length > 1 ? linePath(values, max, 600, 200) : ""

  const kpis: [string, string, string | null, string, LucideIcon, string][] = data
    ? [
        ["Visualizações", nf(data.views.period), fmtChange(data.views.change), P.sub, Eye, "#FF5A36"],
        ["Visualizações (total)", nf(data.views.allTime), null, "desde o início", TrendingUp, "#F7E27A"],
        ["Posts", nf(data.posts.total), null, `${data.posts.byStatus.published ?? 0} publicados`, FileText, "#F7E27A"],
        ["Comentários pendentes", nf(data.comments.pending), null, `${nf(data.comments.approved)} aprovados`, MessageSquare, "#C9A0E0"],
        ["Comentários aprovados", nf(data.comments.approved), null, `${nf(data.comments.spam)} barrados como spam`, MessagesSquare, "#8BE04E"],
        ["Usuários cadastrados", nf(data.users.total), fmtChange(data.users.change), `+${data.users.newInPeriod} no período`, Users, "#8BE04E"],
      ]
    : []

  const q = overviewQuery.trim().toLowerCase()
  const rows = (data?.topPosts ?? [])
    .filter((p) => !q || (p.title + p.author).toLowerCase().includes(q))
    .sort(
      tab === "recent"
        ? (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
        : tab === "comments"
          ? (a, b) => b.comments - a.comments
          : (a, b) => b.periodViews - a.periodViews || b.views - a.views
    )
    .slice(0, 6)

  const scheduled = posts
    .filter((p) => p.status === "Agendado" && p.sched)
    .sort((a, b) => (a.sched!.date + a.sched!.time).localeCompare(b.sched!.date + b.sched!.time))
    .slice(0, 3)

  const moderate = async (id: number, status: "approved" | "spam" | "trash", msg: string) => {
    try {
      await commentsApi.setStatus(id, status)
      toast.success(msg)
      await Promise.all([load(), reloadPending()])
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const statusTotal = STATUS_BAR.reduce((a, [k]) => a + (data?.posts.byStatus[k] ?? 0), 0)
  const sourceTotal = (data?.sources ?? []).reduce((a, s) => a + s.views, 0)

  return (
    <PageMain>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="min-h-4.5 text-xs text-dp-muted">{longDate}</span>
          <h1 className="m-0 text-[28px] font-bold">Visão geral</h1>
        </div>
        <div className="rounded-full border border-white/18 p-1">
          <PillTabs
            role="group"
            label="Período"
            active={String(days)}
            onSelect={(k) => {
              setDays(Number(k) as Days)
              setHover(null)
            }}
            items={PERIODS.map((p) => ({ key: String(p.key), label: p.label }))}
          />
        </div>
      </div>

      <section aria-label="Indicadores" className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {kpis.map(([label, value, delta, sub, Icon, color], i) => (
          <div
            key={label}
            className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/4 p-4.5 animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-dp"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-dp-muted">{label}</span>
              <span className="grid size-7.5 place-items-center rounded-full" style={{ background: color + "22", color }}>
                <Icon className="size-[15px]" aria-hidden />
              </span>
            </div>
            <span className="text-[28px] font-bold tracking-[-0.01em] tabular-nums">{value}</span>
            <span className="text-xs text-dp-muted">
              {delta && <span className="font-semibold" style={{ color: delta.startsWith("−") ? "#FF8A73" : "#8BE04E" }}>{delta} </span>}
              {sub}
            </span>
          </div>
        ))}
        {!data && <p className="m-0 text-sm text-dp-muted">Carregando indicadores...</p>}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,520px),1fr))] items-start gap-5">
        <Panel aria-labelledby="h-cres" className="col-span-full">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="h-cres" className="m-0 text-base font-semibold">Visualizações por dia</h2>
              <span className="text-xs text-dp-muted">Últimos {days} dias · contadas quando alguém abre um post</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-dp-muted">No período</span>
              <span className="text-lg font-bold text-dp-yellow tabular-nums">{nf(data?.views.period ?? 0)}</span>
            </div>
          </div>
          <div
            className="relative h-60"
            onMouseMove={(e) => {
              if (values.length < 2) return
              const r = e.currentTarget.getBoundingClientRect()
              setHover(Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)))))
            }}
            onMouseLeave={() => setHover(null)}
          >
            <svg viewBox="0 0 600 200" preserveAspectRatio="none" width="100%" height="100%" role="img" aria-label={`Gráfico de visualizações dos últimos ${days} dias`} className="block overflow-visible">
              <defs>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#FF5A36" stopOpacity=".35" />
                  <stop offset="1" stopColor="#FF5A36" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 50H600M0 100H600M0 150H600" stroke="rgba(255,255,255,.07)" vectorEffect="non-scaling-stroke" />
              {line && <path d={line + "L600,200L0,200Z"} fill="url(#gA)" />}
              {line && <path d={line} fill="none" stroke="#FF5A36" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
            </svg>
            {data && !data.views.period && (
              <p className="absolute inset-0 m-0 grid place-items-center text-sm text-dp-muted">Ainda não há visitas registradas neste período.</p>
            )}
            {hover != null && series[hover] && (
              <>
                <div className="pointer-events-none absolute inset-y-0 w-px bg-white/35" style={{ left: `${(hover / (values.length - 1)) * 100}%` }} />
                <div
                  className="pointer-events-none absolute top-2 flex flex-col gap-1 rounded-xl border border-white/20 bg-dp-panel px-3 py-2.5 text-xs whitespace-nowrap"
                  style={{ left: `${(hover / (values.length - 1)) * 100}%`, transform: `translateX(${hover / (values.length - 1) > 0.7 ? "calc(-100% - 10px)" : "10px"})` }}
                >
                  <span className="font-semibold">{fmtDate(series[hover].day)}</span>
                  <span className="text-dp-orange">{nf(series[hover].views)} visualizações</span>
                </div>
              </>
            )}
          </div>
          {series.length > 0 && (
            <div className="flex justify-between text-xs text-[#9C8AA6]">
              {[0, Math.floor(series.length / 2), series.length - 1].map((i) => <span key={i}>{fmtDate(series[i].day)}</span>)}
            </div>
          )}
        </Panel>

        <Panel aria-labelledby="h-status">
          <SectionTitle id="h-status" aside={`${statusTotal} no total`}>Posts por status</SectionTitle>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-white/7">
            {STATUS_BAR.map(([k]) => <span key={k} style={{ flex: data?.posts.byStatus[k] ?? 0, background: STATUS_BAR_COLOR[k] }} />)}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
            {STATUS_BAR.map(([k, label]) => (
              <div key={k} className="flex items-center gap-2.5 rounded-xl border border-white/8 px-3 py-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: STATUS_BAR_COLOR[k] }} />
                <span className="flex flex-col">
                  <span className="text-lg font-bold tabular-nums">{data?.posts.byStatus[k] ?? 0}</span>
                  <span className="text-xs text-dp-muted">{label}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel aria-labelledby="h-origem" className="gap-3.5">
          <SectionTitle id="h-origem" aside={`Últimos ${days} dias`}>Origem dos visitantes</SectionTitle>
          {Object.entries(SOURCES).map(([key, [label, color]]) => {
            const n = data?.sources.find((s) => s.source === key)?.views ?? 0
            const pct = sourceTotal ? Math.round((n / sourceTotal) * 100) : 0
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-[13px]">
                  <span className="min-w-0">{label}</span>
                  <span className="shrink-0 whitespace-nowrap text-dp-muted tabular-nums">
                    {nf(n)} · <span className="font-semibold text-white">{pct}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/7">
                  <div className="h-full rounded-full transition-[width] duration-600 ease-dp" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
          {data && !sourceTotal && <Empty>Sem visitas no período ainda.</Empty>}
        </Panel>

        <Panel aria-labelledby="h-top" className="col-span-full gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="h-top" className="m-0 text-base font-semibold">Posts publicados</h2>
            <PillTabs
              label="Ordenar posts"
              active={tab}
              onSelect={setTab}
              items={[
                { key: "top", label: "Mais acessados" },
                { key: "comments", label: "Mais comentados" },
                { key: "recent", label: "Mais recentes" },
              ]}
            />
          </div>
          <div className="overflow-x-auto [scrollbar-color:rgba(255,255,255,.2)_transparent]">
            <table className="w-full min-w-180 border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-xs text-[#9C8AA6]">
                  {["Post", "Categoria"].map((h) => <th key={h} className="border-b border-white/10 px-2.5 py-2 font-medium">{h}</th>)}
                  {[`Views (${days} dias)`, "Views (total)", "Comentários", "SEO"].map((h) => <th key={h} className="border-b border-white/10 px-2.5 py-2 text-right font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-white/3 [&>td]:border-b [&>td]:border-white/6 [&>td]:p-2.5">
                    <td>
                      <div className="flex items-center gap-3">
                        <Thumb url={p.img} />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <Link href={`/painel/posts/${p.id}`} className="font-semibold text-white no-underline hover:text-dp-yellow">{p.title}</Link>
                          <span className="text-xs text-dp-muted">{p.author}</span>
                        </span>
                      </div>
                    </td>
                    <td><CatChip kind={KIND_LABEL[p.type] ?? "Notícia"} /></td>
                    <td className="text-right font-semibold tabular-nums">{nf(p.periodViews)}</td>
                    <td className="text-right tabular-nums text-dp-muted">{nf(p.views)}</td>
                    <td className="text-right tabular-nums">{nf(p.comments)}</td>
                    <td className="text-right"><SeoBadge score={p.seo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && !rows.length && <Empty>{q ? <>Nenhum post encontrado para &quot;{overviewQuery}&quot;.</> : "Nenhum post publicado ainda."}</Empty>}
        </Panel>

        {can("moderate") && (
          <Panel aria-labelledby="h-com" className="gap-3.5">
            <SectionTitle id="h-com" aside={`${data?.comments.pending ?? 0} aguardando · ${nf(data?.comments.approved ?? 0)} aprovados`}>Comentários pendentes</SectionTitle>
            {data?.comments.pendingList.map((c) => (
              <div key={c.id} className="flex gap-3 rounded-xl border border-white/8 p-3">
                <Avatar ini={initials(c.name)} color="#3B0A45" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap gap-1.5 text-xs text-dp-muted">
                    <span className="font-semibold text-white">{c.name}</span>
                    <span className="whitespace-nowrap">em {c.post}</span>
                    <span className="whitespace-nowrap">· {c.time}</span>
                  </div>
                  <p className="m-0 text-[13px] leading-normal wrap-anywhere text-dp-body">{c.content}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <button onClick={() => moderate(c.id, "approved", "Comentário aprovado")} className="h-7.5 cursor-pointer rounded-full bg-dp-green px-3.5 text-xs font-semibold text-dp-bg hover:brightness-110">Aprovar</button>
                    <button onClick={() => moderate(c.id, "spam", "Marcado como spam")} className="h-7.5 cursor-pointer rounded-full border border-white/30 px-3.5 text-xs font-semibold hover:border-dp-yellow hover:text-dp-yellow">Spam</button>
                    <button onClick={() => moderate(c.id, "trash", "Movido para a lixeira")} aria-label="Excluir comentário" className="h-7.5 cursor-pointer rounded-full border border-white/30 px-3.5 text-xs font-semibold text-[#FF8A73] hover:border-[#FF8A73]">Excluir</button>
                  </div>
                </div>
              </div>
            ))}
            {data && !data.comments.pendingList.length && <Empty>Tudo moderado por aqui.</Empty>}
          </Panel>
        )}

        <Panel aria-labelledby="h-ag" className="gap-3">
          <SectionTitle id="h-ag" aside="próximos">Agendados</SectionTitle>
          {scheduled.map((p) => (
            <div key={p.id} className="flex items-center gap-3.5 rounded-xl border border-white/8 p-2.5">
              <span className="flex w-13 shrink-0 flex-col items-center rounded-[10px] bg-dp-yellow/12 py-1.5 text-dp-yellow">
                <span className="text-lg leading-none font-bold">{Number(p.sched!.date.slice(8))}</span>
                <span className="text-[11px] font-semibold uppercase">{monthShort(p.sched!.date)}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{p.title}</span>
                <span className="text-xs text-dp-muted">{p.sched!.time} · {p.author}</span>
              </span>
              <CatChip kind={p.cat} />
            </div>
          ))}
          {!scheduled.length && <Empty>Nenhum post agendado.</Empty>}
        </Panel>

        <Panel aria-labelledby="h-at" className="gap-1">
          <h2 id="h-at" className="m-0 mb-2.5 text-base font-semibold">Atividade recente</h2>
          {data?.activity.map((a, i) => (
            <div key={i} className="flex gap-3 py-2">
              <Avatar ini={initials(a.who) || "?"} color={a.color} size={28} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[13px] leading-[1.45]"><span className="font-semibold">{a.who}</span> {a.what}</span>
                <span className="text-xs text-[#9C8AA6]">{a.when}</span>
              </span>
            </div>
          ))}
          {data && !data.activity.length && <Empty>Nada por aqui ainda.</Empty>}
        </Panel>

        <Panel aria-labelledby="h-al" className="gap-2.5">
          <h2 id="h-al" className="m-0 mb-1 text-base font-semibold">Alertas</h2>
          {data?.alerts.map((a) => {
            const [Icon, color] = ALERT_ICON[a.level]
            const body = (
              <>
                <Icon className="mt-px size-4.5 shrink-0" style={{ color }} aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-white">{a.title}</span>
                  <span className="text-xs text-dp-muted">{a.description}</span>
                </span>
              </>
            )
            const cls = "flex items-start gap-3 rounded-xl border p-3 no-underline"
            const style = { background: color + "12", borderColor: color + "40" }
            return a.href ? (
              <Link key={a.title} href={a.href} className={cls} style={style}>{body}</Link>
            ) : (
              <div key={a.title} className={cls} style={style}>{body}</div>
            )
          })}
        </Panel>
      </div>
    </PageMain>
  )
}

