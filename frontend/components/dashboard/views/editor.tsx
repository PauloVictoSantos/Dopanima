"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { TmdbPanel } from "@/components/dashboard/tmdb-panel"
import { Field, PageMain, Panel, Switch, btnOutline, btnPrimary, inputCls, pillCls, selectCls, textareaCls } from "@/components/dashboard/ui"
import { ApiError, errorMessage } from "@/lib/api"
import {
  KIND_CATEGORY_SLUG, STATUS_CODE, STATUS_LABEL, postsApi, seoApi,
  type ApiPost, type PostPayload, type SeoReport, type SeoStatus, type TmdbType,
} from "@/lib/dashboard-api"
import { CAT_COLOR, STATUS_COLOR, TIMEZONES, fmtDate, nowTime, seoColor, thumbBg, type PostKind, type PostStatus } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

type Draft = {
  id: number | null
  title: string
  slug: string
  slugEdited: boolean
  subtitle: string
  excerpt: string
  categoryId: number | null
  subcategoryId: number | null
  tags: string[]
  tagIn: string
  authorId: number | null
  coverId: number | null
  coverUrl: string
  tmdb: { id: number; type: TmdbType } | null
  /** Nota do autor, 0 a 10 (passos de 0,5); null = sem nota. */
  authorRating: number | null
  status: PostStatus
  featured: boolean
  book: string
  bookAuthor: string
  date: string
  time: string
  tz: string
  focus: string
  metaTitle: string
  metaDesc: string
  canonical: string
  index: boolean
  follow: boolean
  html: string
  savedAt: string
  changed: string
}

const KIND_BY_SLUG = Object.fromEntries(Object.entries(KIND_CATEGORY_SLUG).map(([k, slug]) => [slug, k])) as Record<string, PostKind>

const tomorrow = () => {
  const d = new Date(Date.now() + 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function draftFrom(p: ApiPost | null, defaults: { categoryId: number | null; subcategoryId: number | null; authorId: number | null }): Draft {
  return {
    id: p?.id ?? null,
    title: p?.title ?? "",
    slug: p?.slug ?? "",
    slugEdited: !!p,
    subtitle: p?.subtitle ?? "",
    excerpt: p?.excerpt ?? "",
    categoryId: p ? (p.category?.id ?? null) : defaults.categoryId,
    subcategoryId: p ? (p.subcategory?.id ?? null) : defaults.subcategoryId,
    tags: p ? [...p.tags] : [],
    tagIn: "",
    authorId: p?.author.id ?? defaults.authorId,
    coverId: p?.cover?.id ?? null,
    coverUrl: p?.cover?.url ?? "",
    tmdb: p?.tmdb ?? null,
    authorRating: p?.authorRating ?? null,
    status: p ? (STATUS_LABEL[p.status] ?? "Rascunho") : "Rascunho",
    featured: p?.featured ?? false,
    book: p?.book ?? "",
    bookAuthor: p?.bookAuthor ?? "",
    date: p?.schedule?.date ?? tomorrow(),
    time: p?.schedule?.time ?? "09:00",
    tz: p?.timezone ?? "America/Manaus",
    focus: p?.focusKeyword ?? "",
    metaTitle: p?.metaTitle ?? "",
    metaDesc: p?.metaDescription ?? "",
    canonical: p?.canonicalUrl ?? "",
    index: p?.index ?? true,
    follow: p?.follow ?? true,
    html: p?.content ?? "",
    savedAt: "",
    changed: p ? fmtDate(p.updatedAt.slice(0, 10)) : "",
  }
}

const ask = (msg: string) => window.prompt(msg)?.trim()

// Campos que contam como "conteúdo do post" para saber se há alterações não salvas.
const CONTENT_KEYS = [
  "title", "slug", "subtitle", "excerpt", "html", "categoryId", "subcategoryId", "tags", "authorId", "coverId", "tmdb",
  "authorRating", "featured", "book", "bookAuthor", "focus", "metaTitle", "metaDesc", "canonical", "index", "follow",
] as const
type Snapshot = Pick<Draft, (typeof CONTENT_KEYS)[number]>
const snapshot = (d: Draft): Snapshot => Object.fromEntries(CONTENT_KEYS.map((k) => [k, d[k]])) as Snapshot
const same = (a: Snapshot, b: Snapshot) => JSON.stringify(a) === JSON.stringify(b)

/** Cópia de segurança no navegador: se a aba fechar sem salvar, o texto pode ser recuperado. */
const backupKey = (id: number | null) => `dopanima:editor:${id ?? "novo"}`
type Backup = { at: number; data: Snapshot }
const readBackup = (id: number | null): Backup | null => {
  try {
    const raw = localStorage.getItem(backupKey(id))
    return raw ? (JSON.parse(raw) as Backup) : null
  } catch {
    return null
  }
}
const clearBackup = (...ids: (number | null)[]) => {
  try {
    for (const id of ids) localStorage.removeItem(backupKey(id))
  } catch {}
}

const fmtRating = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// [label, aria label, font classes, command]
const TOOLS: [string, string, string, (ex: (cmd: string, val?: string) => void) => void][] = [
  ["B", "Negrito", "font-bold text-sm", (ex) => ex("bold")],
  ["I", "Itálico", "italic font-semibold text-sm font-serif", (ex) => ex("italic")],
  ["U", "Sublinhado", "font-semibold text-sm underline", (ex) => ex("underline")],
  ["S", "Tachado", "font-semibold text-sm line-through", (ex) => ex("strikeThrough")],
  ["H1", "Título 1", "font-bold text-xs", (ex) => ex("formatBlock", "h1")],
  ["H2", "Título 2", "font-bold text-xs", (ex) => ex("formatBlock", "h2")],
  ["H3", "Título 3", "font-bold text-xs", (ex) => ex("formatBlock", "h3")],
  ["H4", "Título 4", "font-bold text-xs", (ex) => ex("formatBlock", "h4")],
  ["¶", "Parágrafo", "font-semibold text-sm", (ex) => ex("formatBlock", "p")],
  ["“ ”", "Citação", "font-bold text-sm", (ex) => ex("formatBlock", "blockquote")],
  ["</>", "Código", "font-semibold text-xs font-mono", (ex) => ex("formatBlock", "pre")],
  ["• Lista", "Lista", "font-semibold text-xs", (ex) => ex("insertUnorderedList")],
  ["1. Lista", "Lista numerada", "font-semibold text-xs", (ex) => ex("insertOrderedList")],
  ["☐ Tarefas", "Checklist", "font-semibold text-xs", (ex) => ex("insertHTML", '<ul data-check="1"><li>Item</li></ul>')],
  ["Link", "Inserir link", "font-semibold text-xs", (ex) => { const u = ask("URL do link (ex.: /post/duna ou https://...)"); if (u) ex("createLink", u) }],
  ["Imagem", "Inserir imagem", "font-semibold text-xs", (ex) => { const u = ask("URL da imagem"); if (u) ex("insertImage", u) }],
  ["Vídeo", "Inserir vídeo", "font-semibold text-xs", (ex) => { const u = ask("URL do vídeo"); if (u) ex("insertHTML", `<p data-embed="1">▶ Vídeo: ${escapeHtml(u)}</p>`) }],
  ["Áudio", "Inserir áudio", "font-semibold text-xs", (ex) => { const u = ask("URL do áudio"); if (u) ex("insertHTML", `<p data-embed="1">♪ Áudio: ${escapeHtml(u)}</p>`) }],
  ["Tabela", "Inserir tabela", "font-semibold text-xs", (ex) => ex("insertHTML", "<table><tr><th>Coluna</th><th>Coluna</th></tr><tr><td>—</td><td>—</td></tr></table><p></p>")],
  ["―", "Separador", "font-semibold text-sm", (ex) => ex("insertHorizontalRule")],
  ["Botão", "Inserir botão", "font-semibold text-xs", (ex) => ex("insertHTML", '<p><a href="#" data-btn="1">Ler mais</a></p>')],
  ["Embed", "Incorporar", "font-semibold text-xs", (ex) => { const u = ask("Link para incorporar (Instagram, X, Spotify...)"); if (u) ex("insertHTML", `<p data-embed="1">⧉ ${escapeHtml(u)}</p>`) }],
  ["↶", "Desfazer", "font-semibold text-[15px]", (ex) => ex("undo")],
  ["↷", "Refazer", "font-semibold text-[15px]", (ex) => ex("redo")],
]

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
}

export function EditorView({ id }: { id?: number }) {
  const { cats, me, loading } = useDashboard()
  const [post, setPost] = useState<ApiPost | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "missing">(id != null ? "loading" : "ready")

  useEffect(() => {
    if (id == null) return
    postsApi
      .get(id)
      .then((p) => {
        setPost(p)
        setState("ready")
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setState("missing")
        else toast.error(errorMessage(e))
      })
  }, [id])

  if (state === "missing") {
    return (
      <PageMain>
        <h1 className="m-0 text-[28px] font-bold">Post não encontrado</h1>
        <p className="m-0 text-sm text-dp-muted">
          Ele pode ter sido excluído. <Link href="/painel/posts">Voltar para os posts</Link>
        </p>
      </PageMain>
    )
  }
  if (state === "loading" || (id == null && loading)) {
    return (
      <PageMain>
        <p className="m-0 text-sm text-dp-muted">Carregando editor...</p>
      </PageMain>
    )
  }

  const root = cats.find((c) => c.parent === 0)
  const defaults = { categoryId: root?.id ?? null, subcategoryId: cats.find((c) => root && c.parent === root.id)?.id ?? null, authorId: me?.id ?? null }
  return <Editor key={id ?? "novo"} initial={draftFrom(post, defaults)} />
}

const CHECK_ICON: Record<SeoStatus, [string, string]> = { good: ["✓", "#8BE04E"], warning: ["!", "#F7E27A"], error: ["✕", "#FF8A73"] }
const GROUPS: [string, string][] = [
  ["keyword", "Palavra-chave"], ["meta", "Título e descrição"], ["content", "Conteúdo"], ["readability", "Legibilidade"],
  ["media", "Imagens"], ["links", "Links"], ["technical", "Técnico"],
]

function Editor({ initial }: { initial: Draft }) {
  const { cats, tags: allTags, media, authors, can, reloadPosts, reloadMedia } = useDashboard()
  const [e, setE] = useState(initial)
  const [preview, setPreview] = useState(false)
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState<SeoReport | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const seedHtml = useRef(initial.html)
  const [tmdbRating, setTmdbRating] = useState<number | null>(null)
  // Último estado salvo no servidor: diferente do atual = alterações não salvas.
  const [savedSnap, setSavedSnap] = useState(() => snapshot(initial))
  const [backup, setBackup] = useState<Backup | null>(null)
  const dirty = !same(snapshot(e), savedSnap)

  // The body is an uncontrolled contentEditable: seed it once, then read it back on input.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = seedHtml.current
  }, [])

  // Havia texto não salvo de uma sessão anterior? Oferece restaurar.
  useEffect(() => {
    const b = readBackup(initial.id)
    if (b && !same(b.data, snapshot(initial))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the browser backup once after mount
      setBackup(b)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, [])

  // Guarda uma cópia local enquanto há alterações não salvas.
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(backupKey(e.id), JSON.stringify({ at: Date.now(), data: snapshot(e) } satisfies Backup))
      } catch {}
    }, 800)
    return () => clearTimeout(t)
  }, [e, dirty])

  // Avisa antes de fechar/recarregar a aba ou sair do editor por um link com alterações não salvas.
  useEffect(() => {
    if (!dirty) return
    const onUnload = (ev: BeforeUnloadEvent) => {
      ev.preventDefault()
      ev.returnValue = ""
    }
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null
      if (!a || a.target === "_blank" || ev.ctrlKey || ev.metaKey) return
      if (!window.confirm("Você tem alterações não salvas neste post. Sair mesmo assim? (Uma cópia fica guardada neste navegador.)")) {
        ev.preventDefault()
        ev.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty])

  const restoreBackup = () => {
    if (!backup) return
    setE((d) => ({ ...d, ...backup.data }))
    if (bodyRef.current) bodyRef.current.innerHTML = backup.data.html
    setBackup(null)
    toast.success("Texto não salvo restaurado. Lembre de salvar.")
  }

  // Análise de SEO ao vivo, feita pelo backend (debounce de 600 ms).
  useEffect(() => {
    const t = setTimeout(() => {
      seoApi
        .analyze({
          postId: e.id ?? undefined,
          title: e.title,
          slug: e.slug || "",
          excerpt: e.excerpt,
          content: e.html,
          focusKeyword: e.focus,
          metaTitle: e.metaTitle,
          metaDescription: e.metaDesc,
          canonicalUrl: e.canonical,
          index: e.index,
          coverId: e.coverId,
        })
        .then(setReport)
        .catch(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [e.id, e.title, e.slug, e.excerpt, e.html, e.focus, e.metaTitle, e.metaDesc, e.canonical, e.index, e.coverId])

  const set = (patch: Partial<Draft>) => setE((d) => ({ ...d, ...patch }))
  const touch = (patch: Partial<Draft>) => set({ ...patch, savedAt: "" })

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    if (bodyRef.current) touch({ html: bodyRef.current.innerHTML })
  }

  const roots = cats.filter((c) => c.parent === 0)
  const root = roots.find((c) => c.id === e.categoryId)
  const subOpts = cats.filter((c) => root && c.parent === root.id)
  const kind: PostKind = (root && KIND_BY_SLUG[root.slug]) || "Notícia"
  const images = media.filter((m) => m.type === "Imagem")
  const score = report?.score ?? 0
  const words = report?.stats.words ?? 0
  const readTime = `${report?.stats.readTimeMinutes ?? 1} min`

  const save = async (status: PostStatus) => {
    if (!e.title.trim()) return toast.error("Dê um título ao post antes de salvar")
    const payload: PostPayload = {
      title: e.title.trim(),
      ...(e.slugEdited || !e.id ? { slug: e.slugEdited ? e.slug : "" } : {}),
      subtitle: e.subtitle,
      excerpt: e.excerpt,
      content: e.html,
      status: STATUS_CODE[status],
      featured: e.featured,
      book: e.book,
      bookAuthor: e.bookAuthor,
      categoryId: e.categoryId,
      subcategoryId: e.subcategoryId,
      coverId: e.coverId,
      tmdbId: e.tmdb?.id ?? null,
      tmdbType: e.tmdb?.type ?? null,
      authorRating: e.authorRating,
      tags: e.tags,
      timezone: e.tz,
      focusKeyword: e.focus,
      metaTitle: e.metaTitle,
      metaDescription: e.metaDesc,
      canonicalUrl: e.canonical,
      index: e.index,
      follow: e.follow,
      ...(e.authorId ? { authorId: e.authorId } : {}),
      ...(status === "Agendado" ? { scheduleDate: e.date, scheduleTime: e.time } : {}),
    }
    setSaving(true)
    try {
      const saved = e.id ? await postsApi.update(e.id, payload) : await postsApi.create(payload)
      // Swap /novo for the post's own URL without remounting the editor.
      if (!e.id) window.history.replaceState(null, "", `/painel/posts/${saved.id}`)
      const next = { ...e, id: saved.id, slug: saved.slug, slugEdited: true, status: STATUS_LABEL[saved.status], savedAt: nowTime() }
      setE(next)
      setSavedSnap(snapshot(next))
      setBackup(null)
      clearBackup(e.id, saved.id)
      toast.success(
        status === "Publicado" ? "Post publicado"
          : status === "Agendado" ? `Agendado para ${fmtDate(e.date)} às ${e.time} (${e.tz})`
          : status === "Em revisão" ? "Enviado para revisão"
          : "Rascunho salvo"
      )
      void reloadPosts()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Ctrl+S usa sempre a versão mais recente de save (com o rascunho atual).
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault()
        void saveRef.current(e.status === "Lixeira" || e.status === "Arquivado" ? "Rascunho" : e.status)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [e.status])

  const addTag = (raw: string) => {
    const n = raw.trim().replace(/^#/, "").toLowerCase()
    set({ tags: n && !e.tags.includes(n) ? [...e.tags, n] : e.tags, tagIn: "" })
  }

  const seoField = (label: string, key: "focus" | "metaTitle" | "metaDesc" | "canonical", ph: string, limit?: number) => {
    const v = e[key]
    return (
      <Field
        key={key}
        label={label}
        aside={limit ? <span style={{ color: v.length > limit ? "#FF8A73" : "#9C8AA6" }}>{v.length}/{limit}</span> : undefined}
      >
        <input value={v} onChange={(ev) => set({ [key]: ev.target.value })} placeholder={ph} className={inputCls + " h-9.5 px-3"} />
      </Field>
    )
  }

  const statusColor = STATUS_COLOR[e.status]

  return (
    <PageMain>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          {dirty ? (
            <span className="text-xs font-semibold text-dp-yellow">● Alterações não salvas · Ctrl+S para salvar</span>
          ) : (
            <span className="text-xs text-dp-green">{e.savedAt ? "Tudo salvo às " + e.savedAt : e.id ? "Tudo salvo" : "Novo post"}</span>
          )}
          <h1 className="m-0 text-[28px] font-bold">{e.id ? "Editar post" : "Novo post"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPreview(true)} className={btnOutline}>Preview</button>
          {e.id && e.status === "Publicado" ? (
            // Post no ar: "Atualizar" mantém publicado; voltar a rascunho é uma escolha explícita.
            <>
              <button
                disabled={saving}
                onClick={() => window.confirm("Tirar o post do ar e salvar como rascunho?") && save("Rascunho")}
                className={btnOutline}
              >
                Mover para rascunho
              </button>
              <button disabled={saving} onClick={() => save("Publicado")} className={btnPrimary + " px-5.5"}>Atualizar</button>
            </>
          ) : (
            <>
              <button disabled={saving} onClick={() => save("Rascunho")} className={btnOutline}>Salvar rascunho</button>
              {can("publish") && <button disabled={saving} onClick={() => save("Publicado")} className={btnPrimary + " px-5.5"}>Publicar</button>}
            </>
          )}
        </div>
      </div>

      {backup && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-dp-yellow/50 bg-dp-yellow/10 px-4 py-3 text-[13px]">
          <span className="mr-auto">
            Encontramos um texto <b>não salvo</b> deste post, de {new Date(backup.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
          </span>
          <button onClick={restoreBackup} className="h-8 cursor-pointer rounded-full bg-dp-yellow px-4 text-xs font-semibold text-dp-bg">Restaurar texto</button>
          <button
            onClick={() => {
              clearBackup(initial.id)
              setBackup(null)
            }}
            className="h-8 cursor-pointer rounded-full border border-white/30 px-4 text-xs font-semibold"
          >
            Descartar
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <Panel className="flex-[1_1_560px] p-6">
          <input
            value={e.title}
            onChange={(ev) => touch({ title: ev.target.value })}
            placeholder="Título do post"
            aria-label="Título"
            className="w-full border-b border-white/14 bg-transparent px-0 pt-1 pb-3 text-[28px] font-bold text-white outline-none focus:border-dp-yellow"
          />
          <label className="flex flex-wrap items-center gap-1 text-xs text-[#9C8AA6]">
            /post/
            <input
              value={e.slug}
              onChange={(ev) => set({ slug: ev.target.value, slugEdited: true })}
              aria-label="Slug"
              placeholder="gerado a partir do título"
              className="h-7.5 min-w-0 flex-[1_1_200px] rounded-lg border border-white/14 bg-white/3 px-2.5 text-xs font-medium text-white outline-none focus:border-dp-yellow"
            />
          </label>
          <Field label="Subtítulo">
            <input value={e.subtitle} onChange={(ev) => touch({ subtitle: ev.target.value })} placeholder="Linha de apoio exibida abaixo do título" className={inputCls} />
          </Field>
          <Field label="Resumo">
            <textarea
              value={e.excerpt}
              onChange={(ev) => touch({ excerpt: ev.target.value })}
              rows={2}
              placeholder="Uma ou duas frases que aparecem nos cards e no Google"
              className={textareaCls}
            />
          </Field>
          <div role="toolbar" aria-label="Formatação" className="sticky top-18 z-5 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#22092C] p-2">
            {TOOLS.map(([label, aria, font, run]) => (
              <button
                key={aria}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => run(exec)}
                aria-label={aria}
                title={aria}
                className={cn("h-8 min-w-8 cursor-pointer rounded-lg px-2 whitespace-nowrap text-white hover:bg-white/10", font)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            ref={bodyRef}
            className="rich-text min-h-95 px-0.5 py-1"
            data-placeholder="Comece a escrever..."
            contentEditable
            suppressContentEditableWarning
            onInput={(ev) => touch({ html: ev.currentTarget.innerHTML })}
            role="textbox"
            aria-multiline="true"
            aria-label="Conteúdo do post"
          />
          <div className="flex flex-wrap gap-4 border-t border-white/8 pt-3 text-xs text-dp-muted">
            <span>{words} palavras</span>
            <span>{readTime} de leitura</span>
            {report && <span>Legibilidade (Flesch): {report.stats.fleschScore}/100</span>}
            <span>{e.savedAt ? "Última alteração: hoje, " + e.savedAt : e.changed ? "Última alteração: " + e.changed : "Ainda não salvo"}</span>
          </div>
        </Panel>

        <div className="flex max-w-105 min-w-0 flex-[1_1_320px] flex-col gap-4">
          <Panel className="gap-3 p-4.5">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-semibold">Publicação</h2>
              <span className="inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold" style={{ borderColor: statusColor, color: statusColor }}>{e.status}</span>
            </div>
            <Field label="Autor">
              <select value={e.authorId ?? ""} disabled={!can("editAll")} onChange={(ev) => set({ authorId: Number(ev.target.value) })} className={selectCls + " disabled:opacity-60"}>
                {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Data">
                <input type="date" value={e.date} onChange={(ev) => set({ date: ev.target.value })} className={inputCls + " px-2.5 scheme-dark"} />
              </Field>
              <Field label="Hora">
                <input type="time" value={e.time} onChange={(ev) => set({ time: ev.target.value })} className={inputCls + " px-2.5 scheme-dark"} />
              </Field>
            </div>
            <Field label="Fuso horário">
              <select value={e.tz} onChange={(ev) => set({ tz: ev.target.value })} className={selectCls}>
                {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px]">Destaque na home</span>
              <Switch on={e.featured} onToggle={() => set({ featured: !e.featured })} label="Destaque na home" />
            </div>
            <div className="flex flex-wrap gap-2">
              {can("schedule") && (
                <button disabled={saving} onClick={() => save("Agendado")} className="h-9.5 flex-1 cursor-pointer rounded-full border border-dp-yellow px-3.5 text-xs font-semibold text-dp-yellow hover:bg-dp-yellow/10">Agendar</button>
              )}
              <button disabled={saving} onClick={() => save("Em revisão")} className="h-9.5 flex-1 cursor-pointer rounded-full border border-white/30 px-3.5 text-xs font-semibold whitespace-nowrap hover:border-dp-lilac hover:text-dp-lilac">Enviar p/ revisão</button>
            </div>
          </Panel>

          <Panel className="gap-3 p-4.5">
            <h2 className="m-0 text-[15px] font-semibold">Imagem destacada</h2>
            <div
              className="grid aspect-video place-items-center rounded-xl border border-dashed border-white/25 text-xs text-[#9C8AA6]"
              style={{ background: e.coverUrl ? thumbBg(e.coverUrl) : "rgba(255,255,255,.03)" }}
            >
              {e.coverUrl ? "" : "Escolha uma imagem da biblioteca"}
            </div>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
              {e.coverId && (
                <button onClick={() => set({ coverId: null, coverUrl: "" })} className="h-11 shrink-0 cursor-pointer rounded-lg border border-white/25 px-2.5 text-xs font-semibold">
                  Remover
                </button>
              )}
              {images.map((m) => (
                <button
                  key={m.id}
                  onClick={() => set({ coverId: m.id, coverUrl: m.url })}
                  aria-label={"Usar " + m.name}
                  aria-pressed={m.id === e.coverId}
                  className="size-11 shrink-0 cursor-pointer rounded-lg border-2 p-0"
                  style={{ background: thumbBg(m.url), borderColor: m.id === e.coverId ? "#F7E27A" : "transparent" }}
                />
              ))}
            </div>
          </Panel>

          <TmdbPanel
            value={e.tmdb}
            onChange={(tmdb) => {
              set({ tmdb })
              if (!tmdb) setTmdbRating(null)
            }}
            onDetails={(d) => setTmdbRating(d ? d.rating : null)}
            canImport={can("media")}
            onCover={(m) => {
              set({ coverId: m.id, coverUrl: m.url })
              void reloadMedia()
            }}
            onFill={({ title, overview, tagline }) => {
              // Só preenche o que está vazio, para não apagar o que já foi escrito.
              const patch: Partial<Draft> = {}
              if (!e.title.trim()) patch.title = title
              if (!e.subtitle.trim() && tagline) patch.subtitle = tagline
              if (!e.excerpt.trim() && overview) patch.excerpt = overview.length > 300 ? overview.slice(0, 297).trimEnd() + "..." : overview
              touch(patch)
              toast.success(Object.keys(patch).length ? "Campos vazios preenchidos com os dados da TMDB" : "Título, subtítulo e resumo já estavam preenchidos")
            }}
          />

          <Panel className="gap-3 p-4.5">
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 text-[15px] font-semibold">Sua nota</h2>
              <span className="text-xl font-bold text-dp-yellow">
                {e.authorRating != null ? fmtRating(e.authorRating) : "—"}
                <span className="text-xs text-dp-muted">/10</span>
              </span>
            </div>
            {e.authorRating != null ? (
              <>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={e.authorRating}
                  onChange={(ev) => set({ authorRating: Number(ev.target.value) })}
                  aria-label="Sua nota de 0 a 10"
                  className="w-full accent-dp-yellow"
                />
                <div className="flex justify-between text-[11px] text-[#9C8AA6]">
                  <span>0</span>
                  <span>5</span>
                  <span>10</span>
                </div>
                {tmdbRating != null && tmdbRating > 0 && (
                  <span className="text-xs text-dp-muted">
                    Público na TMDB: <b className="text-white">{fmtRating(tmdbRating)}</b> · você deu{" "}
                    <b style={{ color: e.authorRating >= tmdbRating ? "#8BE04E" : "#FF8A73" }}>
                      {e.authorRating === tmdbRating ? "a mesma nota" : `${fmtRating(Math.abs(e.authorRating - tmdbRating))} ${e.authorRating > tmdbRating ? "a mais" : "a menos"}`}
                    </b>
                  </span>
                )}
                <button onClick={() => set({ authorRating: null })} className="self-start text-xs font-semibold text-[#FF8A73]">Remover nota</button>
              </>
            ) : (
              <button
                onClick={() => set({ authorRating: tmdbRating ? Math.round(tmdbRating * 2) / 2 : 7 })}
                className="h-9 cursor-pointer self-start rounded-full border border-dp-yellow px-4 text-xs font-semibold text-dp-yellow hover:bg-dp-yellow/10"
              >
                Dar nota ao {kind === "Livro" ? "livro" : kind === "Série" ? "título" : "filme"}
              </button>
            )}
            <span className="text-[11px] leading-normal text-[#9C8AA6]">Aparece no post ao lado da nota do público (TMDB) e vira avaliação para o Google.</span>
          </Panel>

          <Panel className="gap-3 p-4.5">
            <h2 className="m-0 text-[15px] font-semibold">Categoria e tags</h2>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Categoria">
                <select
                  value={e.categoryId ?? ""}
                  onChange={(ev) => {
                    const cid = Number(ev.target.value) || null
                    set({ categoryId: cid, subcategoryId: cats.find((c) => cid && c.parent === cid)?.id ?? null })
                  }}
                  className={selectCls}
                >
                  {roots.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Subcategoria">
                <select value={e.subcategoryId ?? ""} onChange={(ev) => set({ subcategoryId: Number(ev.target.value) || null })} className={selectCls}>
                  <option value="">Nenhuma</option>
                  {subOpts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
            </div>
            {kind === "Livro" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Livro">
                  <input value={e.book} onChange={(ev) => set({ book: ev.target.value })} placeholder="Título da obra" className={inputCls + " h-9.5 px-3"} />
                </Field>
                <Field label="Autor do livro">
                  <input value={e.bookAuthor} onChange={(ev) => set({ bookAuthor: ev.target.value })} placeholder="Ex.: Stephen King" className={inputCls + " h-9.5 px-3"} />
                </Field>
              </div>
            )}
            {e.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {e.tags.map((n) => (
                  <span key={n} className="inline-flex h-7 items-center gap-1 rounded-full bg-dp-lilac/18 pr-1.5 pl-3 text-xs font-semibold text-dp-lilac">
                    #{n}
                    <button onClick={() => set({ tags: e.tags.filter((x) => x !== n) })} aria-label={`Remover tag ${n}`} className="size-5 cursor-pointer rounded-full text-sm leading-none text-dp-lilac">×</button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={e.tagIn}
              onChange={(ev) => set({ tagIn: ev.target.value })}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === ",") {
                  ev.preventDefault()
                  addTag(e.tagIn)
                }
              }}
              placeholder="Adicionar tag e apertar Enter"
              aria-label="Adicionar tag"
              className={inputCls + " h-9.5"}
            />
            <div className="flex flex-wrap gap-1.5">
              {allTags.filter((t) => !e.tags.includes(t.name)).slice(0, 6).map((t) => (
                <button key={t.id} onClick={() => set({ tags: [...e.tags, t.name] })} className="h-6.5 cursor-pointer rounded-full border border-white/18 px-2.5 text-xs font-medium text-dp-muted hover:border-dp-lilac hover:text-dp-lilac">
                  + {t.name}
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="gap-3 p-4.5">
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 text-[15px] font-semibold">Análise de SEO</h2>
              <span className="text-xl font-bold" style={{ color: seoColor(score) }}>
                {report ? score : "…"}<span className="text-xs text-dp-muted">/100</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full transition-[width] duration-400" style={{ width: `${score}%`, background: seoColor(score) }} />
            </div>
            {report && (
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-dp-muted">
                {([["Densidade", `${String(report.stats.keywordDensity).replace(".", ",")}%`], ["Links internos", report.stats.internalLinks], ["Frases longas", `${report.stats.longSentencesPct}%`]] as const).map(([k, v]) => (
                  <span key={k} className="flex flex-col gap-0.5 rounded-lg bg-white/4 py-1.5">
                    <span className="text-sm font-bold text-white">{v}</span>
                    {k}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {GROUPS.map(([g, title]) => {
                const items = report?.checks.filter((c) => c.group === g) ?? []
                if (!items.length) return null
                return (
                  <div key={g} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold tracking-widest text-[#9C8AA6] uppercase">{title}</span>
                    {items.map((c) => {
                      const [icon, color] = CHECK_ICON[c.status]
                      return (
                        <span key={c.id} className="flex gap-2 text-xs text-dp-body" title={c.message}>
                          <span className="w-4 shrink-0 font-bold" style={{ color }}>{icon}</span>
                          <span>
                            <span className="font-semibold">{c.label}.</span> <span className="text-dp-muted">{c.message}</span>
                          </span>
                        </span>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-col gap-0.5 rounded-[10px] bg-white p-3 text-[#202124]">
              <span className="truncate text-xs text-[#4d5156]">{report?.preview.url ?? "/post/" + e.slug}</span>
              <span className="text-base leading-[1.3] text-[#1a0dab]">{report?.preview.title || e.title || "Título do post"}</span>
              <span className="text-xs leading-[1.45] text-[#4d5156]">{report?.preview.description || "Escreva um resumo ou meta description para aparecer aqui."}</span>
            </div>
            {seoField("Palavra-chave principal", "focus", "Ex.: duna")}
            {seoField("Meta title", "metaTitle", e.title || "Igual ao título", 60)}
            {seoField("Meta description", "metaDesc", e.excerpt || "Resumo para o Google", 160)}
            {seoField("URL canônica", "canonical", "Deixe vazio para usar a URL do post")}
            {([["index", "Indexar no Google"], ["follow", "Seguir links (follow)"]] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-[13px]">{label}</span>
                <Switch on={e[key]} onToggle={() => set({ [key]: !e[key] })} label={label} />
              </div>
            ))}
          </Panel>
        </div>
      </div>

      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Preview do post" onKeyDown={(ev) => ev.key === "Escape" && setPreview(false)} className="fixed inset-0 z-90 flex flex-col items-center gap-3.5 overflow-y-auto bg-black/75 p-5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(["desktop", "mobile"] as const).map((d) => (
              <button key={d} onClick={() => setDevice(d)} aria-pressed={d === device} className={pillCls(d === device)}>
                {d === "desktop" ? "Desktop" : "Mobile"}
              </button>
            ))}
            <button onClick={() => setPreview(false)} autoFocus className="h-9 cursor-pointer rounded-full border border-white/40 px-4.5 text-xs font-semibold">Fechar</button>
          </div>
          <div
            className="w-full shrink-0 overflow-hidden rounded-[20px] border border-white/20 bg-dp-bg transition-[max-width] duration-300"
            style={{ maxWidth: device === "mobile" ? 390 : 900 }}
          >
            <div className="h-60" style={{ background: e.coverUrl ? thumbBg(e.coverUrl) : "rgba(255,255,255,.03)" }} />
            <div className="flex flex-col gap-3 px-[clamp(16px,4vw,48px)] pt-6 pb-10">
              <span className="inline-flex h-6.5 items-center self-start rounded-full px-3 text-xs font-semibold text-dp-bg" style={{ background: CAT_COLOR[kind] }}>{kind}</span>
              <h1 className="m-0 font-display leading-[1.02] font-normal" style={{ fontSize: device === "mobile" ? 32 : 52 }}>{e.title || "Título do post"}</h1>
              <span className="text-[13px] text-dp-muted">{authors.find((a) => a.id === e.authorId)?.name} · {readTime} de leitura</span>
              <p className="m-0 text-[15px] text-dp-lilac">{e.subtitle || e.excerpt}</p>
              <div className="rich-text mt-2" dangerouslySetInnerHTML={{ __html: e.html }} />
            </div>
          </div>
        </div>
      )}
    </PageMain>
  )
}
