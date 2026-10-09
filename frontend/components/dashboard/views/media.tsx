"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { FileText, Music, Upload, Video, type LucideIcon } from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Field, PageHeading, PageMain, Panel, PillTabs, btnDanger, btnPrimary, inputCls, selectCls, textareaCls } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { MEDIA_CODE, mediaApi, toMediaItem, type MediaPatch } from "@/lib/dashboard-api"
import type { MediaItem, MediaKind } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

const ICON: Record<Exclude<MediaKind, "Imagem">, LucideIcon> = { Vídeo: Video, Áudio: Music, Documento: FileText }
const TYPES: { key: MediaKind | "Todos"; label: string }[] = [
  { key: "Todos", label: "Todos" },
  { key: "Imagem", label: "Imagens" },
  { key: "Vídeo", label: "Vídeos" },
  { key: "Áudio", label: "Áudios" },
  { key: "Documento", label: "Documentos" },
]
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/webm,video/quicktime,audio/*,application/pdf"

function MediaIcon({ type, size }: { type: MediaKind; size: number }) {
  if (type === "Imagem") return null
  const Icon = ICON[type]
  return <Icon style={{ width: size, height: size }} strokeWidth={1.5} aria-hidden />
}

export function MediaView() {
  const { reloadMedia, reloadPosts, can } = useDashboard()
  const [type, setType] = useState<MediaKind | "Todos">("Todos")
  const [folder, setFolder] = useState("Todas")
  const [folders, setFolders] = useState<string[]>([])
  const [q, setQ] = useState("")
  const [items, setItems] = useState<MediaItem[]>([])
  const [stats, setStats] = useState({ total: 0, missingAlt: 0 })
  const [selId, setSelId] = useState<number | null>(null)
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)
  const editable = can("media")

  // Filtros e busca rodam no backend.
  const load = useCallback(async () => {
    try {
      const res = await mediaApi.list({ type: type === "Todos" ? undefined : MEDIA_CODE[type], folder: folder === "Todas" ? undefined : folder, q: q.trim() })
      const list = res.items.map(toMediaItem)
      setItems(list)
      setStats({ total: res.total, missingAlt: res.missingAlt })
      setSelId((id) => (id && list.some((m) => m.id === id) ? id : (list[0]?.id ?? null)))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }, [type, folder, q])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    mediaApi.folders().then(setFolders).catch(() => {})
  }, [])

  const refresh = async () => {
    await Promise.all([load(), reloadMedia()])
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const added = await mediaApi.upload([...files], folder === "Todas" ? undefined : folder)
      setType("Todos")
      setQ("")
      await refresh()
      setSelId(added[0]?.id ?? null)
      toast.success(added.length > 1 ? `${added.length} arquivos enviados` : "1 arquivo enviado")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const sel = items.find((m) => m.id === selId)

  return (
    <PageMain>
      <PageHeading eyebrow={`${stats.total} arquivos · ${stats.missingAlt} imagens sem texto alternativo`} title="Biblioteca de mídia">
        {editable && (
          <label className={cn(btnPrimary, uploading && "pointer-events-none opacity-70")}>
            <Upload className="size-3.5" strokeWidth={2.5} aria-hidden />
            {uploading ? "Enviando..." : "Enviar arquivos"}
            <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = "" }} />
          </label>
        )}
      </PageHeading>

      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            addFiles(e.dataTransfer.files)
          }}
          className={cn(
            "rounded-2xl border-2 border-dashed p-5.5 text-center text-[13px] text-dp-muted transition-colors",
            drag ? "border-dp-yellow bg-dp-yellow/8" : "border-white/20"
          )}
        >
          Arraste imagens, vídeos, áudios, GIFs ou PDFs para cá. Envio múltiplo permitido.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <PillTabs role="group" label="Tipo" active={type} onSelect={setType} items={TYPES} />
        <select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Pasta" className={selectCls + " h-9"}>
          <option value="Todas">Todas as pastas</option>
          {folders.map((f) => <option key={f}>{f}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar arquivos" aria-label="Buscar arquivos" className={inputCls + " h-9 flex-[1_1_200px]"} />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section className="grid min-w-0 flex-[2_1_480px] grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {items.map((m) => {
            const active = m.id === selId
            return (
              <button
                key={m.id}
                onClick={() => setSelId(m.id)}
                aria-pressed={active}
                className={cn(
                  "flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-[14px] border-2 bg-white/3 p-1.5 text-left text-white hover:bg-white/7",
                  active ? "border-dp-yellow" : "border-transparent"
                )}
              >
                <span
                  className="relative grid aspect-square place-items-center rounded-[10px] text-dp-lilac"
                  style={{ background: m.type === "Imagem" ? `url("${m.url}") center/cover no-repeat, #3B0A45` : "#2A0A36" }}
                >
                  <MediaIcon type={m.type} size={30} />
                  {m.type === "Imagem" && !m.alt && (
                    <span className="absolute top-1.5 right-1.5 grid h-5 place-items-center rounded-full bg-dp-yellow px-1.5 text-[10px] font-bold text-dp-bg">sem alt</span>
                  )}
                </span>
                <span className="truncate text-xs font-semibold">{m.name}</span>
                <span className="text-[11px] text-[#9C8AA6]">{m.type} · {m.size}</span>
              </button>
            )
          })}
          {!items.length && <p className="m-0 text-[13px] text-dp-muted">Nenhum arquivo encontrado.</p>}
        </section>

        {sel && (
          <MediaDetail
            key={sel.id}
            item={sel}
            folders={folders}
            editable={editable}
            onSaved={async (msg, seoChanged) => {
              await refresh()
              if (seoChanged) void reloadPosts()
              if (msg) toast.success(msg)
            }}
          />
        )}
      </div>
    </PageMain>
  )
}

function MediaDetail({ item, folders, editable, onSaved }: { item: MediaItem; folders: string[]; editable: boolean; onSaved: (msg: string, seoChanged?: boolean) => Promise<void> }) {
  const [d, setD] = useState({ name: item.name, alt: item.alt, caption: item.caption, desc: item.desc, folder: item.folder })

  // Salva o campo ao sair dele, se mudou.
  const commit = async (key: keyof typeof d) => {
    const orig = { name: item.name, alt: item.alt, caption: item.caption, desc: item.desc, folder: item.folder }[key]
    if (d[key] === orig) return
    const patch: MediaPatch = key === "desc" ? { description: d.desc } : { [key]: d[key] }
    try {
      await mediaApi.update(item.id, patch)
      await onSaved("Alterações salvas", key === "alt" && item.usedIn > 0)
    } catch (e) {
      toast.error(errorMessage(e))
      setD((x) => ({ ...x, [key]: orig }))
    }
  }

  const input = (key: "name" | "alt" | "caption", label: string, ph = "", warn = false) => (
    <Field label={label}>
      <input
        value={d[key]}
        disabled={!editable}
        onChange={(e) => setD((x) => ({ ...x, [key]: e.target.value }))}
        onBlur={() => commit(key)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder={ph}
        className={cn(inputCls, "h-9.5 px-3", warn && "border-dp-yellow")}
      />
    </Field>
  )

  return (
    <Panel className="sticky top-22.5 flex-[1_1_300px] gap-3 p-4.5">
      <div
        className="grid aspect-[16/10] place-items-center rounded-xl text-dp-lilac"
        style={{ background: item.type === "Imagem" ? `url("${item.url}") center/contain no-repeat, #0E0212` : "#2A0A36" }}
      >
        <MediaIcon type={item.type} size={44} />
      </div>
      {input("name", "Nome do arquivo")}
      {item.type === "Imagem" && input("alt", "Texto alternativo (alt)", "Descreva a imagem para leitores de tela", !d.alt)}
      {input("caption", "Legenda", "Aparece abaixo da imagem no post")}
      <Field label="Descrição">
        <textarea value={d.desc} disabled={!editable} onChange={(e) => setD((x) => ({ ...x, desc: e.target.value }))} onBlur={() => commit("desc")} rows={2} className={textareaCls + " px-3"} />
      </Field>
      <Field label="Pasta">
        <select
          value={d.folder}
          disabled={!editable}
          onChange={async (e) => {
            const folder = e.target.value
            setD((x) => ({ ...x, folder }))
            try {
              await mediaApi.update(item.id, { folder })
              await onSaved(`Movido para ${folder}`)
            } catch (err) {
              toast.error(errorMessage(err))
            }
          }}
          className={selectCls}
        >
          {[...new Set([...folders, d.folder])].map((f) => <option key={f}>{f}</option>)}
        </select>
      </Field>
      <div className="flex gap-1.5">
        <input value={item.url} readOnly aria-label="URL do arquivo" className="h-9 min-w-0 flex-1 rounded-[10px] border border-white/12 bg-black/20 px-2.5 text-xs text-dp-muted" />
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(item.url)
              toast.success("URL copiada")
            } catch {
              toast.error("Não foi possível copiar a URL")
            }
          }}
          className="h-9 shrink-0 cursor-pointer rounded-full border border-white/30 px-3.5 text-xs font-semibold hover:border-dp-yellow hover:text-dp-yellow"
        >
          Copiar URL
        </button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-xs">
        {([["Tipo", item.type], ["Tamanho", item.size], ["Dimensões", item.dims], ["Enviado em", item.date], ["Autor", item.author], ["Usado como capa", `${item.usedIn} post(s)`]] as const).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[#9C8AA6]">{k}</dt>
            <dd className="m-0">{v}</dd>
          </div>
        ))}
      </dl>
      {editable && (
        <div className="flex gap-2">
          <label className="grid h-9.5 flex-1 cursor-pointer place-items-center rounded-full border border-white/30 text-xs font-semibold hover:border-dp-yellow hover:text-dp-yellow">
            Substituir arquivo
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (!f) return
                try {
                  await mediaApi.replace(item.id, f)
                  await onSaved("Arquivo substituído", item.usedIn > 0)
                } catch (err) {
                  toast.error(errorMessage(err))
                }
              }}
            />
          </label>
          <button
            onClick={async () => {
              if (item.usedIn && !window.confirm(`Este arquivo é capa de ${item.usedIn} post(s), que ficarão sem imagem. Excluir?`)) return
              try {
                await mediaApi.remove(item.id)
                await onSaved("Arquivo excluído", item.usedIn > 0)
              } catch (err) {
                toast.error(errorMessage(err))
              }
            }}
            className={btnDanger + " h-9.5 flex-1"}
          >
            Excluir
          </button>
        </div>
      )}
    </Panel>
  )
}
