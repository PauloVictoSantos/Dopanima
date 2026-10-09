"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Field, PageHeading, PageMain, Panel, SeoBadge, Thumb, btnOutline, btnPrimary, inputCls, textareaCls } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { STATUS_LABEL, seoApi, type Redirect, type SeoOverview, type SeoStatus, type SiteSettings } from "@/lib/dashboard-api"
import { seoColor } from "@/lib/dashboard"

const LEVEL: Record<SeoStatus, [typeof CircleCheck, string]> = {
  good: [CircleCheck, "#8BE04E"],
  warning: [TriangleAlert, "#F7E27A"],
  error: [CircleX, "#FF8A73"],
}

const cell = "border-t border-white/6 px-1.5 py-2.25"

export function SeoView() {
  const { can, reloadPosts } = useDashboard()
  const [data, setData] = useState<SeoOverview | null>(null)
  const [redirects, setRedirects] = useState<Redirect[]>([])
  const [robots, setRobots] = useState("")
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [busy, setBusy] = useState(false)
  const editable = can("seo")

  const load = useCallback(async () => {
    try {
      setData(await seoApi.overview())
      if (editable) {
        const [r, rb, s] = await Promise.all([seoApi.redirects(), seoApi.robots(), seoApi.settings()])
        setRedirects(r)
        setRobots(rb.content)
        setSettings(s)
      }
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }, [editable])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from the API on mount; state is set after it resolves
    void load()
  }, [load])

  const run = async (task: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try {
      await task()
      await load()
      toast.success(msg)
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const addRedirect = async () => {
    if (!from.trim() || !to.trim()) return toast.error("Preencha origem e destino")
    if (await run(() => seoApi.addRedirect(from, to), "Redirecionamento 301 criado")) {
      setFrom("")
      setTo("")
    }
  }

  const k = data?.kpis
  const kpis: [string, string, string][] = [
    ["Nota média", k ? `${k.avgScore}/100` : "—", k ? seoColor(k.avgScore) : "#fff"],
    ["Posts abaixo de 65", String(k?.below65 ?? "—"), "#FF8A73"],
    ["Posts indexáveis", k ? `${k.indexable} de ${k.published}` : "—", "#fff"],
    ["Imagens sem alt", String(k?.imagesWithoutAlt ?? "—"), k?.imagesWithoutAlt ? "#F7E27A" : "#8BE04E"],
  ]
  const dist = k?.distribution
  const distTotal = dist ? dist.good + dist.ok + dist.poor || 1 : 1

  return (
    <PageMain>
      <PageHeading eyebrow="Análise feita pelo servidor a cada post salvo" title="SEO">
        <a href="/sitemap.xml" target="_blank" rel="noreferrer" className={btnOutline + " no-underline"}>Ver sitemap.xml</a>
        {editable && (
          <button disabled={busy} onClick={() => run(async () => { await seoApi.recalculate(); await reloadPosts() }, "Notas de SEO recalculadas")} className={btnPrimary}>
            Recalcular notas
          </button>
        )}
      </PageHeading>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {kpis.map(([label, value, color]) => (
          <div key={label} className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/4 p-4.5">
            <span className="text-[13px] text-dp-muted">{label}</span>
            <span className="text-[28px] font-bold tabular-nums" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {dist && (
        <div className="flex flex-col gap-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-white/8" aria-label="Distribuição das notas">
            <span style={{ width: `${(dist.good / distTotal) * 100}%`, background: "#8BE04E" }} />
            <span style={{ width: `${(dist.ok / distTotal) * 100}%`, background: "#F7E27A" }} />
            <span style={{ width: `${(dist.poor / distTotal) * 100}%`, background: "#FF8A73" }} />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-dp-muted">
            <span><b className="text-dp-green">{dist.good}</b> bons (80+)</span>
            <span><b className="text-dp-yellow">{dist.ok}</b> razoáveis (65–79)</span>
            <span><b className="text-[#FF8A73]">{dist.poor}</b> fracos (abaixo de 65)</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] items-start gap-5">
        <Panel className="gap-2.5">
          <h2 className="m-0 mb-1 text-base font-semibold">Posts para revisar</h2>
          {data?.toFix.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-t border-white/6 py-2">
              <Thumb url={p.img} className="h-12.5 w-9 rounded-md border-0" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{p.title} <span className="font-normal text-[#9C8AA6]">· {STATUS_LABEL[p.status]}</span></span>
                <span className="text-xs text-dp-muted">{p.issue}</span>
              </span>
              <SeoBadge score={p.score} />
              <Link
                href={`/painel/posts/${p.id}`}
                className="grid h-7.5 shrink-0 place-items-center rounded-full border border-dp-yellow px-3.5 text-xs font-semibold whitespace-nowrap text-dp-yellow no-underline hover:bg-dp-yellow/10"
              >
                Corrigir
              </Link>
            </div>
          ))}
          {!data && <p className="m-0 text-[13px] text-dp-muted">Analisando...</p>}
        </Panel>

        <Panel className="gap-2.5">
          <h2 className="m-0 mb-1 text-base font-semibold">Saúde técnica</h2>
          {data?.health.map((h) => {
            const [Icon, color] = LEVEL[h.level]
            return (
              <div key={h.id} className="flex items-start gap-3 border-t border-white/6 py-2.5">
                <Icon className="mt-px size-4.5 shrink-0" style={{ color }} aria-hidden />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold">
                    {h.href ? <a href={h.href} target={h.href.endsWith(".xml") ? "_blank" : undefined} rel="noreferrer" className="text-white">{h.label}</a> : h.label}
                  </span>
                  <span className="text-xs text-dp-muted">{h.description}</span>
                </span>
              </div>
            )
          })}
          {editable && (
            <>
              <Field label="robots.txt" className="mt-1.5">
                <textarea
                  value={robots}
                  onChange={(e) => setRobots(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  className={textareaCls + " bg-[#0E0212] p-3 font-mono text-xs leading-[1.6] text-dp-body"}
                />
              </Field>
              <button disabled={busy} onClick={() => run(() => seoApi.saveRobots(robots), "robots.txt salvo")} className={btnOutline + " self-start"}>Salvar robots.txt</button>
            </>
          )}
        </Panel>

        <Panel className="gap-2.5 overflow-x-auto">
          <h2 className="m-0 mb-1 text-base font-semibold">Palavras-chave em foco</h2>
          <p className="m-0 text-xs text-dp-muted">Quando dois posts disputam a mesma palavra-chave, eles competem entre si no Google (canibalização).</p>
          <table className="w-full min-w-110 border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-xs text-[#9C8AA6] [&>th]:px-1.5 [&>th]:py-2 [&>th]:font-medium">
                <th>Termo</th><th>Posts</th><th className="text-right">Nota</th>
              </tr>
            </thead>
            <tbody>
              {data?.keywords.map((kw) => (
                <tr key={kw.keyword} className="align-top">
                  <td className={cell + " font-semibold"}>
                    {kw.keyword}
                    {kw.conflict && <span className="ml-2 rounded-full bg-[#FF8A73]/15 px-2 py-0.5 text-[11px] font-semibold text-[#FF8A73]">conflito</span>}
                  </td>
                  <td className={cell}>
                    {kw.posts.map((p) => (
                      <Link key={p.id} href={`/painel/posts/${p.id}`} className="block text-white no-underline hover:text-dp-yellow">{p.title}</Link>
                    ))}
                  </td>
                  <td className={cell + " text-right tabular-nums"}>
                    {kw.posts.map((p) => <span key={p.id} className="block font-semibold" style={{ color: seoColor(p.score) }}>{p.score}</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.keywords.length && <p className="m-0 text-[13px] text-dp-muted">Nenhum post tem palavra-chave definida.</p>}
        </Panel>

        {editable && (
          <Panel className="gap-2.5">
            <h2 className="m-0 mb-1 text-base font-semibold">Redirecionamentos 301</h2>
            <p className="m-0 text-xs text-dp-muted">Trocar o slug de um post publicado cria o redirecionamento automaticamente.</p>
            <div className="flex flex-wrap gap-2">
              <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="/url-antiga" aria-label="URL de origem" className={inputCls + " flex-[1_1_150px]"} />
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRedirect()}
                placeholder="/post/url-nova"
                aria-label="URL de destino"
                className={inputCls + " flex-[1_1_150px]"}
              />
              <button disabled={busy} onClick={addRedirect} className={btnPrimary + " tracking-[0.06em]"}>Adicionar</button>
            </div>
            {redirects.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2.5 border-t border-white/6 py-2.5 text-[13px]">
                <span className="flex min-w-0 flex-[1_1_260px] flex-wrap items-center gap-1.5">
                  <span className="text-dp-muted">{r.from}</span>
                  <span className="text-dp-yellow">→</span>
                  <span className="font-semibold">{r.to}</span>
                </span>
                <span className="shrink-0 text-xs text-[#9C8AA6]">{r.hits} acessos</span>
                <button
                  onClick={() => run(() => seoApi.removeRedirect(r.id), "Redirecionamento removido")}
                  className="h-7.5 shrink-0 cursor-pointer rounded-full border border-[#FF8A73]/45 px-3.5 text-xs font-semibold text-[#FF8A73] hover:bg-[#FF8A73]/10"
                >
                  Remover
                </button>
              </div>
            ))}
            {!redirects.length && <p className="m-0 text-[13px] text-dp-muted">Nenhum redirecionamento.</p>}
          </Panel>
        )}

        {editable && settings && <SeoSettings initial={settings} onSave={(s) => run(async () => { await seoApi.saveSettings(s); await reloadPosts() }, "Configurações de SEO salvas")} busy={busy} />}
      </div>
    </PageMain>
  )
}

function SeoSettings({ initial, onSave, busy }: { initial: SiteSettings; onSave: (s: Partial<SiteSettings>) => void; busy: boolean }) {
  const [s, setS] = useState(initial)
  const field = (key: "siteName" | "siteUrl" | "titleTemplate" | "ogImage", label: string, ph = "") => (
    <Field label={label}>
      <input value={s[key]} onChange={(e) => setS((x) => ({ ...x, [key]: e.target.value }))} placeholder={ph} className={inputCls} />
    </Field>
  )
  return (
    <Panel className="gap-2.5">
      <h2 className="m-0 mb-1 text-base font-semibold">Configurações de SEO do site</h2>
      {field("siteName", "Nome do site")}
      {field("siteUrl", "URL pública do site", "https://dopanima.com")}
      {field("titleTemplate", "Modelo de título", "%titulo% | Dopanima")}
      <Field label="Meta description padrão">
        <textarea value={s.defaultMetaDescription} onChange={(e) => setS((x) => ({ ...x, defaultMetaDescription: e.target.value }))} rows={2} className={textareaCls} />
      </Field>
      {field("ogImage", "Imagem padrão para redes sociais (URL)", "https://...")}
      <span className="text-xs text-dp-muted">Mudar o modelo de título ou a URL recalcula a nota de todos os posts.</span>
      <button
        disabled={busy}
        onClick={() => onSave({ siteName: s.siteName, siteUrl: s.siteUrl, titleTemplate: s.titleTemplate, defaultMetaDescription: s.defaultMetaDescription, ogImage: s.ogImage })}
        className={btnOutline + " self-start"}
      >
        Salvar configurações
      </button>
    </Panel>
  )
}
