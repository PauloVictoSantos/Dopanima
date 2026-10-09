"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, PenLine, Trash2 } from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { RowActions } from "@/components/dashboard/row-actions"
import { Field, PageHeading, PageMain, Panel, btnOutline, btnPrimary, inputCls, selectCls, textareaCls } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { categoriesApi } from "@/lib/dashboard-api"
import { thumbBg, type Category } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

type Form = { id: number | null; name: string; slug: string; desc: string; parent: string; img: string; color: string }
const EMPTY: Form = { id: null, name: "", slug: "", desc: "", parent: "0", img: "", color: "" }

export function CategoriesView() {
  const { cats, reloadCats, reloadPosts, media, can } = useDashboard()
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState(false)
  const setF = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const editable = can("taxonomy")

  const parents = cats.filter((c) => c.parent === 0)
  // The API already returns the list in tree order (each root followed by its children).
  const rows = cats.map((c) => ({ ...c, depth: c.parent ? 1 : 0 }))

  const run = async (task: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try {
      await task()
      await reloadCats()
      if (msg) toast.success(msg)
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!form.name.trim()) return toast.error("Dê um nome à categoria")
    const data = { name: form.name.trim(), slug: form.slug.trim() || undefined, description: form.desc, parentId: Number(form.parent) || null, imageUrl: form.img, color: form.color }
    const ok = await run(() => (form.id ? categoriesApi.update(form.id, data) : categoriesApi.create(data)), form.id ? "Categoria atualizada" : "Categoria criada")
    if (ok) setForm(EMPTY)
  }

  const remove = async (r: Category) => {
    const kids = cats.filter((c) => c.parent === r.id).length
    if (!window.confirm(`Excluir "${r.name}"${kids ? ` e ${kids} subcategoria(s)` : ""}? Os posts ficam sem essa categoria.`)) return
    if (await run(() => categoriesApi.remove(r.id), `Categoria "${r.name}" excluída`)) {
      if (form.id === r.id) setForm(EMPTY)
      void reloadPosts()
    }
  }

  return (
    <PageMain>
      <PageHeading eyebrow={`${cats.length} categorias · ${parents.length} principais`} title="Categorias" />
      <div className="flex flex-wrap items-start gap-5">
        <Panel className="flex-[2_1_520px] gap-0 p-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className={cn("flex items-center gap-3 rounded-[10px] py-2.5 pr-2.5 hover:bg-white/4", form.id === r.id && "bg-dp-yellow/8")}
              style={{ paddingLeft: r.depth ? 40 : 12 }}
            >
              {r.depth > 0 && <span className="shrink-0 text-[13px] text-[#9C8AA6]">└</span>}
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.depth ? "rgba(255,255,255,.25)" : r.color || "#C9A0E0" }} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("font-semibold", r.depth ? "text-[13px]" : "text-[15px]")}>{r.name}</span>
                <span className="truncate text-xs text-[#9C8AA6]">/{r.slug} · {r.desc || "Sem descrição"}</span>
              </span>
              <span className="shrink-0 text-xs whitespace-nowrap text-dp-muted">{r.count} posts</span>
              {editable && (
                <RowActions
                  label={r.name}
                  groups={[
                    [{ label: "Editar", icon: PenLine, onClick: () => setForm({ id: r.id, name: r.name, slug: r.slug, desc: r.desc, parent: String(r.parent), img: r.img, color: r.color }) }],
                    [
                      { label: "Mover para cima", icon: ChevronUp, onClick: () => run(() => categoriesApi.move(r.id, "up"), "") },
                      { label: "Mover para baixo", icon: ChevronDown, onClick: () => run(() => categoriesApi.move(r.id, "down"), "") },
                    ],
                    [{ label: "Excluir", icon: Trash2, destructive: true, onClick: () => remove(r) }],
                  ]}
                />
              )}
            </div>
          ))}
          {!rows.length && <p className="m-0 p-2.5 text-[13px] text-dp-muted">Nenhuma categoria ainda.</p>}
        </Panel>

        {editable && (
          <Panel className="sticky top-22.5 flex-[1_1_300px] gap-3">
            <h2 className="m-0 text-base font-semibold">{form.id ? "Editar categoria" : "Nova categoria"}</h2>
            <Field label="Nome">
              <input value={form.name} onChange={(e) => setF({ name: e.target.value })} placeholder="Ex.: Animação" className={inputCls} />
            </Field>
            <Field label="Slug">
              <input value={form.slug} onChange={(e) => setF({ slug: e.target.value })} placeholder="gerado a partir do nome" className={inputCls} />
            </Field>
            <Field label="Categoria pai">
              <select value={form.parent} onChange={(e) => setF({ parent: e.target.value })} className={selectCls}>
                <option value="0">Nenhuma (principal)</option>
                {parents.filter((p) => p.id !== form.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Descrição">
              <textarea value={form.desc} onChange={(e) => setF({ desc: e.target.value })} rows={3} placeholder="Aparece no topo da página da categoria" className={textareaCls} />
            </Field>
            {form.parent === "0" && (
              <Field label="Cor">
                <input type="color" value={form.color || "#C9A0E0"} onChange={(e) => setF({ color: e.target.value })} className="h-9 w-16 cursor-pointer rounded-lg border border-white/20 bg-transparent" />
              </Field>
            )}
            <div className="flex flex-col gap-1.5 text-xs font-medium text-dp-muted">
              Imagem
              <div className="flex flex-wrap gap-1.5">
                {media.filter((m) => m.type === "Imagem").slice(0, 12).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setF({ img: m.url === form.img ? "" : m.url })}
                    aria-label={"Usar " + m.name}
                    aria-pressed={m.url === form.img}
                    className="size-10 cursor-pointer rounded-lg border-2 p-0"
                    style={{ background: thumbBg(m.url), borderColor: m.url === form.img ? "#F7E27A" : "transparent" }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={busy} className={btnPrimary + " flex-1"}>{form.id ? "Salvar" : "Criar categoria"}</button>
              {form.id && <button onClick={() => setForm(EMPTY)} className={btnOutline}>Cancelar</button>}
            </div>
          </Panel>
        )}
      </div>
    </PageMain>
  )
}
