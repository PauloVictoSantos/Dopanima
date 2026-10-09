"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PenLine, Trash2 } from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Field, IconAction, PageHeading, PageMain, Panel, btnOutline, btnPrimary, inputCls } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { tagsApi } from "@/lib/dashboard-api"
import type { TagItem } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

type Form = { id: number | null; name: string; slug: string }
const EMPTY: Form = { id: null, name: "", slug: "" }

export function TagsView() {
  const { tags, reloadTags, reloadPosts, can } = useDashboard()
  const [q, setQ] = useState("")
  const [form, setForm] = useState<Form>(EMPTY)
  const editable = can("taxonomy")

  // The API returns tags sorted by usage.
  const tq = q.trim().toLowerCase()
  const rows = tags.filter((t) => !tq || t.name.includes(tq))
  const max = Math.max(1, ...tags.map((t) => t.count))

  const run = async (task: () => Promise<unknown>, msg: string) => {
    try {
      await task()
      await reloadTags()
      toast.success(msg)
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    }
  }

  const save = async () => {
    const name = form.name.trim()
    if (!name) return toast.error("Digite o nome da tag")
    const data = { name, slug: form.slug.trim() || undefined }
    const ok = await run(() => (form.id ? tagsApi.update(form.id, data) : tagsApi.create(data)), form.id ? "Tag atualizada" : `Tag #${name.toLowerCase()} criada`)
    if (ok) {
      setForm(EMPTY)
      if (form.id) void reloadPosts()
    }
  }

  const remove = async (t: TagItem) => {
    if (t.count && !window.confirm(`A tag #${t.name} está em ${t.count} post(s). Excluir mesmo assim?`)) return
    if (await run(() => tagsApi.remove(t.id), `Tag #${t.name} excluída`)) {
      if (form.id === t.id) setForm(EMPTY)
      void reloadPosts()
    }
  }

  return (
    <PageMain>
      <PageHeading eyebrow={`${tags.length} tags · ${tags.reduce((a, t) => a + t.count, 0)} usos`} title="Tags" />
      <div className="flex flex-wrap items-start gap-5">
        <Panel className="flex-[2_1_520px] gap-1.5 p-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tags" aria-label="Buscar tags" className={inputCls + " mb-1.5"} />
          {rows.map((t) => (
            <div key={t.id} className={cn("flex items-center gap-3.5 rounded-[10px] p-2.5 hover:bg-white/4", form.id === t.id && "bg-dp-yellow/8")}>
              <span className="flex min-w-0 flex-[0_0_180px] flex-col gap-0.5 max-sm:flex-[0_1_120px]">
                <span className="truncate text-sm font-semibold text-dp-lilac">#{t.name}</span>
                <span className="truncate text-xs text-[#9C8AA6]">/tag/{t.slug}</span>
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/7">
                <span className="block h-full rounded-full bg-dp-lilac" style={{ width: `${Math.round((t.count / max) * 100)}%` }} />
              </span>
              <span className="w-16 shrink-0 text-right text-xs text-dp-muted">{t.count} posts</span>
              {editable && (
                <>
                  <IconAction size={30} label="Editar tag" icon={PenLine} onClick={() => setForm({ id: t.id, name: t.name, slug: t.slug })} />
                  <IconAction size={30} label="Excluir tag" icon={Trash2} color="#FF8A73" onClick={() => remove(t)} />
                </>
              )}
            </div>
          ))}
          {!rows.length && <p className="m-0 p-2.5 text-[13px] text-dp-muted">Nenhuma tag encontrada.</p>}
        </Panel>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          {editable && (
            <Panel className="gap-3">
              <h2 className="m-0 text-base font-semibold">{form.id ? "Editar tag" : "Nova tag"}</h2>
              <Field label="Nome">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.replace(/^#/, "") }))}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  placeholder="Ex.: animação"
                  className={inputCls}
                />
              </Field>
              <Field label="Slug">
                <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="gerado a partir do nome" className={inputCls} />
              </Field>
              <div className="flex gap-2">
                <button onClick={save} className={btnPrimary + " flex-1"}>{form.id ? "Salvar" : "Criar tag"}</button>
                {form.id && <button onClick={() => setForm(EMPTY)} className={btnOutline}>Cancelar</button>}
              </div>
            </Panel>
          )}
          <Panel className="gap-3">
            <h2 className="m-0 text-base font-semibold">Mais usadas</h2>
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 6).map((t) => (
                <span key={t.id} className="inline-flex h-7.5 items-center gap-1.5 rounded-full bg-dp-lilac/16 px-3 text-xs font-semibold text-dp-lilac">
                  #{t.name}
                  <span className="text-white">{t.count}</span>
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </PageMain>
  )
}
