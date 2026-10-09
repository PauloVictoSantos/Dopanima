"use client"

import { useState } from "react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { PageMain, Panel, PillTabs, Thumb } from "@/components/dashboard/ui"
import { linePath, nf, series } from "@/lib/dashboard"

type Range = "7" | "30" | "90"
const RANGES: Record<Range, { n: number; m: number; ticks: string[]; label: string }> = {
  "7": { n: 7, m: 0.25, ticks: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"], label: "Últimos 7 dias" },
  "30": { n: 30, m: 1, ticks: ["6 set", "10", "15", "20", "25", "30", "5 out"], label: "Últimos 30 dias" },
  "90": { n: 90, m: 2.9, ticks: ["jul", "ago", "set", "out"], label: "Últimos 90 dias" },
}

const CATEGORIES: [string, number, string][] = [
  ["Filmes", 38, "#FF5A36"],
  ["Séries", 24, "#8BE04E"],
  ["Livros", 21, "#F7E27A"],
  ["Notícias", 17, "#C9A0E0"],
]
const DEVICES: [string, number, string][] = [
  ["Celular", 68, "#FF5A36"],
  ["Computador", 27, "#F7E27A"],
  ["Tablet", 5, "#C9A0E0"],
]
const CITIES: [string, number][] = [
  ["Manaus, AM", 18],
  ["São Paulo, SP", 16],
  ["Rio de Janeiro, RJ", 11],
  ["Belo Horizonte, MG", 7],
  ["Fortaleza, CE", 6],
  ["Lisboa, Portugal", 3],
]
const READ_TIME = ["4m 10s", "3m 52s", "3m 31s", "5m 02s", "2m 48s", "3m 15s"]
const READ_PCT = [62, 57, 49, 71, 44, 53]

export function AnalyticsView() {
  const { posts } = useDashboard()
  const [range, setRange] = useState<Range>("30")
  const R = RANGES[range]

  const sessions = series(R.n, 3000, Number(range) + 11, 0.3)
  const max = Math.max(...sessions) * 1.15
  const line = linePath(sessions, max, 600, 200)

  const kpis: [string, string, string][] = [
    ["Sessões", nf(96240 * R.m), "+11,2%"],
    ["Usuários únicos", nf(61380 * R.m), "+9,4%"],
    ["Tempo médio no post", "3m 42s", "+18s"],
    ["Taxa de rejeição", "41,8%", "−2,1 p.p."],
    ["Páginas por sessão", "2,7", "+0,3"],
    ["Leitura até o fim", "58%", "+4 p.p."],
  ]
  const top = posts.filter((p) => p.views > 0 && p.status === "Publicado").sort((a, b) => b.views - a.views).slice(0, 6)

  return (
    <PageMain>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-dp-muted">{R.label}</span>
          <h1 className="m-0 text-[28px] font-bold">Analytics</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-9 items-center gap-2 rounded-full bg-dp-green/12 px-3.5 text-xs font-semibold text-dp-green">
            <span className="size-2 rounded-full bg-dp-green" />
            142 leitores agora
          </span>
          <div className="rounded-full border border-white/18 p-1">
            <PillTabs
              role="group"
              label="Período"
              active={range}
              onSelect={setRange}
              items={[
                { key: "7", label: "7 dias" },
                { key: "30", label: "30 dias" },
                { key: "90", label: "90 dias" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {kpis.map(([label, value, delta]) => (
          <div key={label} className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/4 p-4.5">
            <span className="text-[13px] text-dp-muted">{label}</span>
            <span className="text-[26px] font-bold tabular-nums">{value}</span>
            <span className="text-xs font-semibold text-dp-green">{delta}</span>
          </div>
        ))}
      </div>

      <Panel className="gap-3">
        <h2 className="m-0 text-base font-semibold">Sessões por dia</h2>
        <div className="h-55">
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" width="100%" height="100%" role="img" aria-label={`Gráfico de sessões, ${R.label.toLowerCase()}`} className="block overflow-visible">
            <defs>
              <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#C9A0E0" stopOpacity=".35" />
                <stop offset="1" stopColor="#C9A0E0" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 50H600M0 100H600M0 150H600" stroke="rgba(255,255,255,.07)" vectorEffect="non-scaling-stroke" />
            <path d={line + "L600,200L0,200Z"} fill="url(#gS)" />
            <path d={line} fill="none" stroke="#C9A0E0" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex justify-between text-xs text-[#9C8AA6]">
          {R.ticks.map((t) => <span key={t}>{t}</span>)}
        </div>
      </Panel>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-5">
        <Panel className="gap-3.5">
          <h2 className="m-0 text-base font-semibold">Visualizações por categoria</h2>
          {CATEGORIES.map(([label, pct, color]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3 text-[13px]">
                <span>{label}</span>
                <span className="shrink-0 whitespace-nowrap text-dp-muted">
                  {nf((128492 * R.m * pct) / 100)} · <span className="font-semibold text-white">{pct}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/7">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          ))}
        </Panel>

        <Panel className="gap-3.5">
          <h2 className="m-0 text-base font-semibold">Dispositivos</h2>
          <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full">
            {DEVICES.map(([label, pct, color]) => <span key={label} style={{ flex: pct, background: color }} />)}
          </div>
          {DEVICES.map(([label, pct, color]) => (
            <div key={label} className="flex items-center gap-2.5 text-[13px]">
              <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
              <span className="flex-1">{label}</span>
              <span className="font-bold">{pct}%</span>
            </div>
          ))}
        </Panel>

        <Panel className="gap-2.5">
          <h2 className="m-0 mb-1 text-base font-semibold">Cidades</h2>
          {CITIES.map(([label, pct]) => (
            <div key={label} className="flex justify-between gap-3 border-t border-white/6 py-1.5 text-[13px]">
              <span>{label}</span>
              <span className="shrink-0 whitespace-nowrap text-dp-muted">
                {nf((61380 * R.m * pct) / 100)} · <span className="font-semibold text-white">{pct}%</span>
              </span>
            </div>
          ))}
        </Panel>
      </div>

      <Panel className="overflow-x-auto">
        <h2 className="m-0 text-base font-semibold">Posts que mais prendem a leitura</h2>
        <table className="w-full min-w-155 border-collapse text-[13px]">
          <thead>
            <tr className="text-right text-xs text-[#9C8AA6] [&>th]:px-2.5 [&>th]:py-2 [&>th]:font-medium">
              <th className="text-left">Post</th><th>Visualizações</th><th>Tempo médio</th><th className="w-50">Leitura até o fim</th>
            </tr>
          </thead>
          <tbody>
            {top.map((p, i) => (
              <tr key={p.id} className="text-right tabular-nums [&>td]:border-t [&>td]:border-white/6 [&>td]:p-2.5">
                <td className="text-left">
                  <div className="flex items-center gap-3">
                    <Thumb url={p.img} className="h-11 w-8 rounded-md border-0" />
                    <span className="font-semibold">{p.title}</span>
                  </div>
                </td>
                <td className="font-semibold">{nf(p.views * R.m)}</td>
                <td className="text-dp-muted">{READ_TIME[i]}</td>
                <td>
                  <div className="flex items-center justify-end gap-2.5">
                    <span className="h-1.5 max-w-30 flex-1 overflow-hidden rounded-full bg-white/8">
                      <span className="block h-full bg-dp-green" style={{ width: `${READ_PCT[i]}%` }} />
                    </span>
                    <span className="w-9 font-semibold">{READ_PCT[i]}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </PageMain>
  )
}
