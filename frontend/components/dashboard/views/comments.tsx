"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Avatar, Field, PageHeading, PageMain, Panel, PillTabs, StatusPill, SwitchRow, btnPrimary, inputCls, textareaCls } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { commentsApi, type ApiComment, type ApiCommentStatus, type ModerationRules } from "@/lib/dashboard-api"
import { COMMENT_STATUS } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

type Tab = ApiCommentStatus | "all"
type Tone = "ok" | "bad" | "plain"

const TONE: Record<Tone, string> = {
  ok: "border-dp-green bg-dp-green text-dp-bg",
  bad: "border-[#FF8A73]/50 text-[#FF8A73]",
  plain: "border-white/30 text-white",
}
const TABS: [Tab, string][] = [["all", "Todos"], ["pending", "Pendentes"], ["approved", "Aprovados"], ["spam", "Spam"], ["trash", "Lixeira"]]

export function CommentsView() {
  const { reloadPending, reloadPosts } = useDashboard()
  const [tab, setTab] = useState<Tab>("pending")
  const [q, setQ] = useState("")
  const [items, setItems] = useState<ApiComment[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [replyId, setReplyId] = useState<number | null>(null)
  const [replyText, setReplyText] = useState("")
  const [rules, setRules] = useState<ModerationRules | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await commentsApi.list({ status: tab, q: q.trim() })
      setItems(res.items)
      setCounts(res.counts)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [tab, q])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    commentsApi.settings().then(setRules).catch((e) => toast.error(errorMessage(e)))
  }, [])

  const run = async (task: () => Promise<unknown>, msg: string) => {
    try {
      await task()
      toast.success(msg)
      await Promise.all([load(), reloadPending(), reloadPosts()])
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const move = (id: number, status: ApiCommentStatus, msg: string) => run(() => commentsApi.setStatus(id, status), msg)

  const sendReply = async (id: number) => {
    const text = replyText.trim()
    if (!text) return
    await run(() => commentsApi.reply(id, text), "Resposta publicada")
    setReplyId(null)
    setReplyText("")
  }

  const actionsFor = (c: ApiComment): [string, () => void, Tone][] => {
    const reply: [string, () => void, Tone] = ["Responder", () => { setReplyId(c.id); setReplyText("") }, "plain"]
    const spam: [string, () => void, Tone] = ["Spam", () => move(c.id, "spam", "Marcado como spam"), "plain"]
    const trash: [string, () => void, Tone] = ["Lixeira", () => move(c.id, "trash", "Movido para a lixeira"), "bad"]
    const purge: [string, () => void, Tone] = ["Excluir definitivamente", () => run(() => commentsApi.remove(c.id), "Comentário excluído"), "bad"]
    switch (c.status) {
      case "pending":
        return [["Aprovar", () => move(c.id, "approved", "Comentário aprovado"), "ok"], reply, spam, trash]
      case "approved":
        return [["Reprovar", () => move(c.id, "pending", "Comentário voltou para pendentes"), "plain"], reply, spam, trash]
      case "spam":
        return [["Não é spam", () => move(c.id, "pending", "Movido para pendentes"), "plain"], purge]
      default:
        return [["Restaurar", () => move(c.id, "pending", "Comentário restaurado"), "plain"], purge]
    }
  }

  const emptyTab = () => {
    const ids = items.map((c) => c.id)
    if (!ids.length || !window.confirm(`Excluir definitivamente ${ids.length} comentário(s)?`)) return
    void run(() => commentsApi.bulk(ids, "delete"), `${ids.length} comentário(s) excluído(s)`)
  }

  const setRule = <K extends keyof ModerationRules>(key: K, value: ModerationRules[K]) => setRules((r) => (r ? { ...r, [key]: value } : r))
  const ruleSwitch = (key: "autoApproveReturning" | "antispam" | "requireApproval", label: string, desc: string) =>
    rules && <SwitchRow key={key} label={label} desc={desc} on={rules[key]} onToggle={() => setRule(key, !rules[key])} />

  return (
    <PageMain>
      <PageHeading eyebrow="Moderação" title="Comentários">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por texto, nome ou e-mail" aria-label="Buscar comentários" className={inputCls + " w-72"} />
      </PageHeading>
      <PillTabs
        label="Status dos comentários"
        active={tab}
        onSelect={(k) => {
          setTab(k)
          setReplyId(null)
        }}
        items={TABS.map(([key, label]) => ({ key, label, count: counts[key] ?? 0 }))}
      />

      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[2_1_520px] flex-col gap-3">
          {(tab === "spam" || tab === "trash") && items.length > 0 && (
            <button onClick={emptyTab} className="h-8 cursor-pointer self-end rounded-full border border-[#FF8A73]/50 px-4 text-xs font-semibold text-[#FF8A73] hover:bg-[#FF8A73]/10">
              Esvaziar {tab === "spam" ? "spam" : "lixeira"}
            </button>
          )}
          {items.map((c) => {
            const [stLabel, stColor] = COMMENT_STATUS[c.status]
            return (
              <article key={c.id} className="flex gap-3.5 rounded-2xl border border-white/10 bg-white/4 p-4">
                <Avatar ini={c.initials} color={c.color} size={40} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-dp-muted">
                    <span className="text-[13px] font-semibold text-white">{c.name}</span>
                    <span>{c.email}</span>
                    <span className="ml-auto">
                      <StatusPill label={stLabel} color={stColor} />
                    </span>
                  </div>
                  <span className="text-xs text-[#9C8AA6]">
                    em <Link href={`/post/${c.post.slug}`} target="_blank" className="font-semibold text-dp-lilac">{c.post.title}</Link> · {c.time}
                  </span>
                  {/* Texto puro: o React escapa, nada de HTML de leitor é interpretado. */}
                  <p className="m-0 text-sm leading-[1.55] wrap-anywhere whitespace-pre-wrap text-dp-body">{c.content}</p>
                  {c.replies.map((r) => (
                    <div key={r.id} className="mt-1 rounded-[10px] bg-dp-yellow/8 px-3 py-2.5 text-[13px] leading-normal whitespace-pre-wrap">
                      <span className="font-semibold text-dp-yellow">{r.who}:</span> {r.content}
                    </div>
                  ))}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {actionsFor(c).map(([label, act, tone]) => (
                      <button key={label} onClick={act} className={cn("h-7.5 cursor-pointer rounded-full border px-3.5 text-xs font-semibold hover:brightness-115", TONE[tone])}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {replyId === c.id && (
                    <div className="mt-1.5 flex flex-col gap-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        autoFocus
                        placeholder="Escreva sua resposta..."
                        aria-label="Resposta"
                        className={textareaCls + " px-3"}
                      />
                      <div className="flex gap-1.5">
                        <button onClick={() => sendReply(c.id)} className="h-8 cursor-pointer rounded-full bg-dp-orange px-4 text-xs font-semibold">Responder</button>
                        <button onClick={() => setReplyId(null)} className="h-8 cursor-pointer rounded-full border border-white/30 px-4 text-xs font-semibold">Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
          {!items.length && (
            <p className="m-0 rounded-2xl border border-dashed border-white/20 p-5 text-[13px] text-dp-muted">{loading ? "Carregando..." : "Nenhum comentário aqui."}</p>
          )}
        </section>

        <Panel className="flex-[1_1_300px] gap-1.5">
          <h2 className="m-0 mb-1.5 text-base font-semibold">Regras de moderação</h2>
          {ruleSwitch("requireApproval", "Aprovar antes de publicar", "Comentários novos ficam pendentes até alguém aprovar")}
          {ruleSwitch("autoApproveReturning", "Aprovar leitores conhecidos", "Quem já teve comentário aprovado publica direto")}
          {ruleSwitch("antispam", "Filtro anti-spam", "Links em excesso, palavras bloqueadas e padrões suspeitos vão para spam")}
          {rules && (
            <>
              <Field label="Palavras bloqueadas (separe por vírgula)" className="mt-2">
                <textarea value={rules.blockedWords} onChange={(e) => setRule("blockedWords", e.target.value)} rows={3} maxLength={2000} className={textareaCls + " px-3"} />
              </Field>
              <Field label="Limite de links por comentário" className="mt-1.5">
                <input type="number" min={0} max={10} value={rules.maxLinks} onChange={(e) => setRule("maxLinks", Math.max(0, Math.min(10, Number(e.target.value) || 0)))} className={inputCls} />
              </Field>
              <button onClick={() => run(() => commentsApi.saveSettings(rules), "Regras de moderação salvas")} className={btnPrimary + " mt-2.5"}>Salvar regras</button>
            </>
          )}
        </Panel>
      </div>
    </PageMain>
  )
}
