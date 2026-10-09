"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlignLeft, ArrowLeft, ArrowRight, Bold, Check, CheckSquare, ChevronDown, CircleAlert, CircleCheck, CircleX, Code, Eye, Heading1, Heading2,
  Heading3, ImageIcon, Italic, Link2, List, ListOrdered, Minus, Monitor, Music, Plus, Quote, Redo2, Smartphone, Sparkles, Star,
  Strikethrough, Table, Underline, Undo2, Video, X,
} from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { TmdbPanel } from "@/components/dashboard/tmdb-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ApiError, errorMessage } from "@/lib/api"
import {
  KIND_CATEGORY_SLUG, STATUS_CODE, STATUS_LABEL, postsApi, seoApi,
  type ApiPost, type PostPayload, type SeoReport, type SeoStatus, type TmdbType,
} from "@/lib/dashboard-api"
import { CAT_COLOR, STATUS_COLOR, TIMEZONES, fmtDate, nowTime, seoColor, thumbBg, type PostKind, type PostStatus } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

// ============================================================================
// Rascunho e helpers
// ============================================================================

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

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
}

const ask = (msg: string) => window.prompt(msg)?.trim()

type Exec = (cmd: string, val?: string) => void
type Tool = { label: string; icon: React.ComponentType<{ className?: string }>; run: (ex: Exec) => void }

// Barra de formatação: o essencial à vista, o resto em "Inserir".
const FORMAT: Tool[][] = [
  [
    { label: "Negrito (Ctrl+B)", icon: Bold, run: (ex) => ex("bold") },
    { label: "Itálico (Ctrl+I)", icon: Italic, run: (ex) => ex("italic") },
    { label: "Sublinhado (Ctrl+U)", icon: Underline, run: (ex) => ex("underline") },
    { label: "Tachado", icon: Strikethrough, run: (ex) => ex("strikeThrough") },
  ],
  [
    { label: "Título 1", icon: Heading1, run: (ex) => ex("formatBlock", "h1") },
    { label: "Título 2", icon: Heading2, run: (ex) => ex("formatBlock", "h2") },
    { label: "Título 3", icon: Heading3, run: (ex) => ex("formatBlock", "h3") },
    { label: "Parágrafo", icon: AlignLeft, run: (ex) => ex("formatBlock", "p") },
  ],
  [
    { label: "Citação", icon: Quote, run: (ex) => ex("formatBlock", "blockquote") },
    { label: "Lista", icon: List, run: (ex) => ex("insertUnorderedList") },
    { label: "Lista numerada", icon: ListOrdered, run: (ex) => ex("insertOrderedList") },
    { label: "Link", icon: Link2, run: (ex) => { const u = ask("URL do link (ex.: /post/duna ou https://...)"); if (u) ex("createLink", u) } },
  ],
]
const INSERT: Tool[] = [
  { label: "Imagem por URL", icon: ImageIcon, run: (ex) => { const u = ask("URL da imagem"); if (u) ex("insertImage", u) } },
  { label: "Vídeo", icon: Video, run: (ex) => { const u = ask("URL do vídeo"); if (u) ex("insertHTML", `<p data-embed="1">▶ Vídeo: ${escapeHtml(u)}</p>`) } },
  { label: "Áudio", icon: Music, run: (ex) => { const u = ask("URL do áudio"); if (u) ex("insertHTML", `<p data-embed="1">♪ Áudio: ${escapeHtml(u)}</p>`) } },
  { label: "Incorporar (Instagram, X, Spotify...)", icon: Sparkles, run: (ex) => { const u = ask("Link para incorporar"); if (u) ex("insertHTML", `<p data-embed="1">⧉ ${escapeHtml(u)}</p>`) } },
  { label: "Tabela", icon: Table, run: (ex) => ex("insertHTML", "<table><tr><th>Coluna</th><th>Coluna</th></tr><tr><td>—</td><td>—</td></tr></table><p></p>") },
  { label: "Lista de tarefas", icon: CheckSquare, run: (ex) => ex("insertHTML", '<ul data-check="1"><li>Item</li></ul>') },
  { label: "Código", icon: Code, run: (ex) => ex("formatBlock", "pre") },
  { label: "Botão \"Ler mais\"", icon: ArrowRight, run: (ex) => ex("insertHTML", '<p><a href="#" data-btn="1">Ler mais</a></p>') },
  { label: "Separador", icon: Minus, run: (ex) => ex("insertHorizontalRule") },
]

// ============================================================================
// Carregamento
// ============================================================================

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
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 pt-16">
        <h1 className="m-0 text-2xl font-bold">Post não encontrado</h1>
        <p className="m-0 text-sm text-muted-foreground">
          Ele pode ter sido excluído. <Link href="/painel/posts" className="text-dp-yellow">Voltar para os posts</Link>
        </p>
      </main>
    )
  }
  if (state === "loading" || (id == null && loading)) {
    return <main className="px-6 pt-16 text-sm text-muted-foreground">Carregando editor...</main>
  }

  const root = cats.find((c) => c.parent === 0)
  const defaults = { categoryId: root?.id ?? null, subcategoryId: cats.find((c) => root && c.parent === root.id)?.id ?? null, authorId: me?.id ?? null }
  return (
    <TooltipProvider delay={300}>
      <Editor key={id ?? "novo"} initial={draftFrom(post, defaults)} />
    </TooltipProvider>
  )
}

// ============================================================================
// Pequenos componentes
// ============================================================================

const STEPS = [
  { key: "escrever", label: "Escrever", hint: "Título e texto" },
  { key: "midia", label: "Mídia", hint: "Capa e filme/série" },
  { key: "detalhes", label: "Detalhes", hint: "Categoria, tags e nota" },
  { key: "seo", label: "SEO", hint: "Google e redes" },
  { key: "publicar", label: "Publicar", hint: "Revisar e enviar" },
] as const
type StepKey = (typeof STEPS)[number]["key"]

function FormField({ label, htmlFor, hint, aside, children, className }: { label: string; htmlFor?: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</Label>
        {aside}
      </div>
      {children}
      {hint && <span className="text-[11px] text-[#9C8AA6]">{hint}</span>}
    </div>
  )
}

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={cn("text-[11px] tabular-nums", value > max ? "text-destructive" : "text-[#9C8AA6]")}>{value}/{max}</span>
}

const CHECK_ICON: Record<SeoStatus, [React.ComponentType<{ className?: string; style?: React.CSSProperties }>, string]> = {
  good: [CircleCheck, "#8BE04E"],
  warning: [CircleAlert, "#F7E27A"],
  error: [CircleX, "#FF8A73"],
}
const GROUPS: [string, string][] = [
  ["keyword", "Palavra-chave"], ["meta", "Título e descrição"], ["content", "Conteúdo"], ["readability", "Legibilidade"],
  ["media", "Imagens"], ["links", "Links"], ["technical", "Técnico"],
]

// ============================================================================
// Editor
// ============================================================================

function Editor({ initial }: { initial: Draft }) {
  const { cats, tags: allTags, media, authors, can, reloadPosts, reloadMedia } = useDashboard()
  const [e, setE] = useState(initial)
  const [step, setStep] = useState<StepKey>("escrever")
  const [preview, setPreview] = useState(false)
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState<SeoReport | null>(null)
  const [tmdbRating, setTmdbRating] = useState<number | null>(null)
  const [publishMode, setPublishMode] = useState<"now" | "schedule" | "review">("now")
  const bodyRef = useRef<HTMLDivElement>(null)
  const seedHtml = useRef(initial.html)
  // Último estado salvo no servidor: diferente do atual = alterações não salvas.
  const [savedSnap, setSavedSnap] = useState(() => snapshot(initial))
  const [backup, setBackup] = useState<Backup | null>(null)
  const dirty = !same(snapshot(e), savedSnap)

  // O corpo é um contentEditable não controlado: semeado uma vez e lido de volta a cada digitação.
  // Fica sempre montado (as abas só escondem), para o texto não se perder ao trocar de etapa.
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

  const exec: Exec = (cmd, val) => {
    bodyRef.current?.focus()
    document.execCommand(cmd, false, val)
    if (bodyRef.current) touch({ html: bodyRef.current.innerHTML })
  }

  const restoreBackup = () => {
    if (!backup) return
    setE((d) => ({ ...d, ...backup.data }))
    if (bodyRef.current) bodyRef.current.innerHTML = backup.data.html
    setBackup(null)
    toast.success("Texto não salvo restaurado. Lembre de salvar.")
  }

  const roots = cats.filter((c) => c.parent === 0)
  const root = roots.find((c) => c.id === e.categoryId)
  const subOpts = cats.filter((c) => root && c.parent === root.id)
  const kind: PostKind = (root && KIND_BY_SLUG[root.slug]) || "Notícia"
  const images = media.filter((m) => m.type === "Imagem")
  const score = report?.score ?? 0
  const words = report?.stats.words ?? 0
  const readTime = `${report?.stats.readTimeMinutes ?? 1} min`
  const published = !!e.id && e.status === "Publicado"

  // ---------- salvar ----------

  const save = async (status: PostStatus) => {
    if (!e.title.trim()) {
      setStep("escrever")
      return toast.error("Dê um título ao post antes de salvar")
    }
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
      // Troca /novo pela URL do post sem remontar o editor.
      if (!e.id) window.history.replaceState(null, "", `/painel/posts/${saved.id}`)
      const next = { ...e, id: saved.id, slug: saved.slug, slugEdited: true, status: STATUS_LABEL[saved.status], savedAt: nowTime() }
      setE(next)
      setSavedSnap(snapshot(next))
      setBackup(null)
      clearBackup(e.id, saved.id)
      toast.success(
        status === "Publicado" ? (published ? "Post atualizado" : "Post publicado")
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

  /** Salvar mantendo o status atual (botão "Salvar" e Ctrl+S). */
  const quickSave = () => save(e.status === "Lixeira" || e.status === "Arquivado" ? "Rascunho" : e.status)

  // Ctrl+S usa sempre a versão mais recente de quickSave.
  const quickSaveRef = useRef(quickSave)
  useEffect(() => {
    quickSaveRef.current = quickSave
  })
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault()
        void quickSaveRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const addTag = (raw: string) => {
    const n = raw.trim().replace(/^#/, "").toLowerCase()
    set({ tags: n && !e.tags.includes(n) ? [...e.tags, n] : e.tags, tagIn: "" })
  }

  // ---------- etapas ----------

  const done: Record<StepKey, boolean> = {
    escrever: !!e.title.trim() && words >= 50,
    midia: !!e.coverId,
    detalhes: !!e.categoryId && e.tags.length > 0,
    seo: score >= 65,
    publicar: published,
  }
  const stepIndex = STEPS.findIndex((s) => s.key === step)
  const go = (dir: -1 | 1) => setStep(STEPS[Math.max(0, Math.min(STEPS.length - 1, stepIndex + dir))].key)
  const statusColor = STATUS_COLOR[e.status]

  return (
    <main className="flex min-h-[calc(100vh-69px)] w-full flex-col">
      {/* Barra superior fixa: identidade do post, estado e ações principais */}
      <div className="sticky top-[69px] z-20 border-b border-border bg-dp-bg/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-[clamp(16px,3vw,32px)] py-3">
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link href="/painel/posts" aria-label="Voltar para os posts" />} />}>
              <ArrowLeft />
            </TooltipTrigger>
            <TooltipContent>Voltar para os posts</TooltipContent>
          </Tooltip>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{e.title.trim() || (e.id ? "Sem título" : "Novo post")}</span>
            <span className="flex items-center gap-2 text-[11px]">
              <Badge variant="outline" className="h-4.5 px-1.5 text-[10px]" style={{ borderColor: statusColor, color: statusColor }}>{e.status}</Badge>
              {dirty ? (
                <span className="font-semibold text-dp-yellow">● Não salvo · Ctrl+S</span>
              ) : (
                <span className="text-dp-green">{e.savedAt ? `Salvo às ${e.savedAt}` : e.id ? "Tudo salvo" : "Rascunho novo"}</span>
              )}
            </span>
          </div>
          <Button variant="outline" size="lg" onClick={() => setPreview(true)}>
            <Eye /> Prévia
          </Button>
          <Button variant="outline" size="lg" disabled={saving} onClick={quickSave}>
            {published ? "Salvar alterações" : "Salvar rascunho"}
          </Button>
          <Button size="lg" className="rounded-full px-5 font-semibold" onClick={() => setStep("publicar")}>
            {published ? "Atualizar" : "Publicar"} <ArrowRight />
          </Button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-[clamp(16px,3vw,32px)] py-5">
        {backup && (
          <Alert className="border-dp-yellow/50 bg-dp-yellow/10">
            <CircleAlert className="text-dp-yellow" />
            <AlertTitle>Texto não salvo encontrado</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span className="mr-auto">Há uma versão deste post de {new Date(backup.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} que não foi salva.</span>
              <Button size="sm" className="bg-dp-yellow text-dp-bg hover:bg-dp-yellow/85" onClick={restoreBackup}>Restaurar texto</Button>
              <Button size="sm" variant="ghost" onClick={() => { clearBackup(initial.id); setBackup(null) }}>Descartar</Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={step} onValueChange={(v) => setStep(v as StepKey)} className="flex-1 gap-5">
          {/* Etapas */}
          <TabsList variant="line" className="h-auto w-full justify-start gap-1 overflow-x-auto border-b border-border p-0 no-scrollbar">
            {STEPS.map((s, i) => (
              <TabsTrigger
                key={s.key}
                value={s.key}
                className="group h-auto flex-none gap-2.5 rounded-none border-0 border-b-2 border-transparent px-3 py-2.5 text-left data-active:border-dp-yellow data-active:text-white"
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold transition-colors",
                    done[s.key] ? "border-dp-green bg-dp-green text-dp-bg" : "border-white/30 group-data-active:border-dp-yellow group-data-active:bg-dp-yellow group-data-active:text-dp-bg"
                  )}
                >
                  {done[s.key] ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13px] font-semibold">{s.label}</span>
                  <span className="hidden text-[11px] font-normal text-[#9C8AA6] lg:block">{s.hint}</span>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 1. ESCREVER — o corpo fica sempre montado para não perder o texto entre as abas */}
          <TabsContent value="escrever" keepMounted className="flex flex-col gap-4 data-hidden:hidden">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
              <input
                value={e.title}
                onChange={(ev) => touch({ title: ev.target.value })}
                placeholder="Título do post"
                aria-label="Título"
                className="w-full bg-transparent font-display text-[clamp(30px,4vw,44px)] leading-tight text-white outline-none placeholder:text-white/25"
              />
              <input
                value={e.subtitle}
                onChange={(ev) => touch({ subtitle: ev.target.value })}
                placeholder="Subtítulo (opcional)"
                aria-label="Subtítulo"
                className="w-full bg-transparent text-lg text-dp-lilac outline-none placeholder:text-white/25"
              />

              <Card className="gap-0 overflow-visible bg-white/3 py-0">
                <div role="toolbar" aria-label="Formatação" className="sticky top-[138px] z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-border bg-dp-panel/95 px-2 py-1.5 backdrop-blur">
                  {FORMAT.map((group, gi) => (
                    <div key={gi} className="flex items-center gap-0.5">
                      {gi > 0 && <Separator orientation="vertical" className="mx-1 h-5" />}
                      {group.map((t) => (
                        <Tooltip key={t.label}>
                          <TooltipTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label={t.label} onMouseDown={(ev) => ev.preventDefault()} onClick={() => t.run(exec)} />
                            }
                          >
                            <t.icon />
                          </TooltipTrigger>
                          <TooltipContent>{t.label}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  ))}
                  <Separator orientation="vertical" className="mx-1 h-5" />
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="sm" onMouseDown={(ev) => ev.preventDefault()} />}>
                      <Plus /> Inserir <ChevronDown className="opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-60">
                      <DropdownMenuGroup>
                        {INSERT.map((t) => (
                          <DropdownMenuItem key={t.label} onClick={() => t.run(exec)}>
                            <t.icon /> {t.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="ml-auto flex items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Desfazer" onMouseDown={(ev) => ev.preventDefault()} onClick={() => exec("undo")} />}>
                        <Undo2 />
                      </TooltipTrigger>
                      <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Refazer" onMouseDown={(ev) => ev.preventDefault()} onClick={() => exec("redo")} />}>
                        <Redo2 />
                      </TooltipTrigger>
                      <TooltipContent>Refazer</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div
                  ref={bodyRef}
                  className="rich-text min-h-[46vh] px-[clamp(16px,3vw,32px)] py-6"
                  data-placeholder="Comece a escrever sua resenha..."
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(ev) => touch({ html: ev.currentTarget.innerHTML })}
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Conteúdo do post"
                />
                <div className="flex flex-wrap gap-4 rounded-b-xl border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                  <span>{words} palavras</span>
                  <span>{readTime} de leitura</span>
                  {report && <span>Legibilidade: {report.stats.fleschScore}/100</span>}
                  <span className="ml-auto">{e.changed && !e.savedAt ? `Última alteração: ${e.changed}` : ""}</span>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* 2. MÍDIA */}
          <TabsContent value="midia" className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <Card className="bg-white/3">
              <CardHeader>
                <CardTitle>Imagem destacada</CardTitle>
                <CardDescription>Aparece no topo do post, nos cards e no Google.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div
                  className="grid aspect-video place-items-center rounded-lg border border-dashed border-white/25 text-xs text-muted-foreground"
                  style={{ background: e.coverUrl ? thumbBg(e.coverUrl) : "rgba(255,255,255,.03)" }}
                >
                  {e.coverUrl ? "" : "Escolha na biblioteca abaixo ou importe da TMDB"}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Biblioteca ({images.length})</span>
                  {e.coverId && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => set({ coverId: null, coverUrl: "" })}>
                      <X /> Remover capa
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-44 rounded-lg">
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5 pr-3">
                    {images.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => set({ coverId: m.id, coverUrl: m.url })}
                        aria-label={"Usar " + m.name}
                        aria-pressed={m.id === e.coverId}
                        title={m.name}
                        className={cn("aspect-square cursor-pointer rounded-md border-2 p-0", m.id === e.coverId ? "border-dp-yellow" : "border-transparent hover:border-white/40")}
                        style={{ background: thumbBg(m.url) }}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

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
          </TabsContent>

          {/* 3. DETALHES */}
          <TabsContent value="detalhes" className="grid gap-4 lg:grid-cols-2">
            <Card className="bg-white/3">
              <CardHeader>
                <CardTitle>Organização</CardTitle>
                <CardDescription>Onde o post aparece no site.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Categoria">
                    <Select
                      value={e.categoryId ? String(e.categoryId) : null}
                      onValueChange={(v) => {
                        const cid = Number(v) || null
                        set({ categoryId: cid, subcategoryId: cats.find((c) => cid && c.parent === cid)?.id ?? null })
                      }}
                      items={roots.map((c) => ({ value: String(c.id), label: c.name }))}
                    >
                      <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Escolha" /></SelectTrigger>
                      <SelectContent>{roots.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Subcategoria">
                    <Select
                      value={e.subcategoryId ? String(e.subcategoryId) : "0"}
                      onValueChange={(v) => set({ subcategoryId: Number(v) || null })}
                      items={[{ value: "0", label: "Nenhuma" }, ...subOpts.map((c) => ({ value: String(c.id), label: c.name }))]}
                    >
                      <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Nenhuma</SelectItem>
                        {subOpts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                {kind === "Livro" && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Livro" htmlFor="book">
                      <Input id="book" className="h-9" value={e.book} onChange={(ev) => set({ book: ev.target.value })} placeholder="Título da obra" />
                    </FormField>
                    <FormField label="Autor do livro" htmlFor="bookAuthor">
                      <Input id="bookAuthor" className="h-9" value={e.bookAuthor} onChange={(ev) => set({ bookAuthor: ev.target.value })} placeholder="Ex.: Stephen King" />
                    </FormField>
                  </div>
                )}
                <FormField label="Tags" htmlFor="tagIn" hint="Enter ou vírgula para adicionar">
                  <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-input/30 px-2 py-1.5 focus-within:border-ring">
                    {e.tags.map((n) => (
                      <Badge key={n} variant="secondary" className="gap-1 bg-dp-lilac/18 pr-1 text-dp-lilac">
                        #{n}
                        <button onClick={() => set({ tags: e.tags.filter((x) => x !== n) })} aria-label={`Remover tag ${n}`} className="cursor-pointer rounded-full hover:text-white">
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      id="tagIn"
                      value={e.tagIn}
                      onChange={(ev) => set({ tagIn: ev.target.value })}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === ",") {
                          ev.preventDefault()
                          addTag(e.tagIn)
                        }
                      }}
                      placeholder={e.tags.length ? "" : "resenha, terror..."}
                      className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {allTags.filter((t) => !e.tags.includes(t.name)).slice(0, 8).map((t) => (
                      <Button key={t.id} variant="ghost" size="xs" className="text-muted-foreground" onClick={() => set({ tags: [...e.tags, t.name] })}>
                        + {t.name}
                      </Button>
                    ))}
                  </div>
                </FormField>
                <FormField label="Resumo" htmlFor="excerpt" hint="Aparece nos cards e, sem meta description, no Google." aside={<Counter value={e.excerpt.length} max={300} />}>
                  <Textarea id="excerpt" rows={3} value={e.excerpt} onChange={(ev) => touch({ excerpt: ev.target.value })} placeholder="Uma ou duas frases sobre o post" />
                </FormField>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="bg-white/3">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Sua nota
                    <span className="text-2xl font-bold text-dp-yellow">
                      {e.authorRating != null ? fmtRating(e.authorRating) : "—"}<span className="text-xs text-muted-foreground">/10</span>
                    </span>
                  </CardTitle>
                  <CardDescription>Aparece no post ao lado da nota do público e vira avaliação para o Google.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {e.authorRating != null ? (
                    <>
                      <Slider
                        min={0}
                        max={10}
                        step={0.5}
                        value={[e.authorRating]}
                        onValueChange={(v) => set({ authorRating: Array.isArray(v) ? v[0] : v })}
                        aria-label="Sua nota de 0 a 10"
                        className="[&_[data-slot=slider-range]]:bg-dp-yellow [&_[data-slot=slider-thumb]]:size-4"
                      />
                      <div className="flex justify-between text-[11px] text-[#9C8AA6]"><span>0</span><span>5</span><span>10</span></div>
                      {tmdbRating != null && tmdbRating > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Público na TMDB: <b className="text-white">{fmtRating(tmdbRating)}</b> · você deu{" "}
                          <b style={{ color: e.authorRating >= tmdbRating ? "#8BE04E" : "#FF8A73" }}>
                            {e.authorRating === tmdbRating ? "a mesma nota" : `${fmtRating(Math.abs(e.authorRating - tmdbRating))} ${e.authorRating > tmdbRating ? "a mais" : "a menos"}`}
                          </b>
                        </span>
                      )}
                      <Button variant="ghost" size="sm" className="self-start text-destructive" onClick={() => set({ authorRating: null })}>Remover nota</Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      className="self-start border-dp-yellow text-dp-yellow"
                      onClick={() => set({ authorRating: tmdbRating ? Math.round(tmdbRating * 2) / 2 : 7 })}
                    >
                      <Star /> Dar nota ao {kind === "Livro" ? "livro" : kind === "Série" ? "título" : "filme"}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/3">
                <CardHeader>
                  <CardTitle>Autoria e destaque</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <FormField label="Autor">
                    <Select
                      value={e.authorId ? String(e.authorId) : null}
                      onValueChange={(v) => set({ authorId: Number(v) })}
                      disabled={!can("editAll")}
                      items={authors.map((a) => ({ value: String(a.id), label: a.name }))}
                    >
                      <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Autor" /></SelectTrigger>
                      <SelectContent>{authors.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="featured" className="flex flex-col items-start gap-0.5">
                      <span className="text-sm">Destaque na home</span>
                      <span className="text-xs font-normal text-muted-foreground">Entra no carrossel do topo do site</span>
                    </Label>
                    <Switch id="featured" checked={e.featured} onCheckedChange={(v) => set({ featured: v })} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 4. SEO */}
          <TabsContent value="seo" className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <Card className="bg-white/3">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Análise de SEO
                  <span className="text-2xl font-bold" style={{ color: seoColor(score) }}>
                    {report ? score : "…"}<span className="text-xs text-muted-foreground">/100</span>
                  </span>
                </CardTitle>
                <Progress value={score} className="[&_[data-slot=progress-indicator]]:bg-(--seo) [&_[data-slot=progress-indicator]]:transition-all" style={{ ["--seo" as string]: seoColor(score) }} />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {report && (
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground">
                    {([["Densidade", `${String(report.stats.keywordDensity).replace(".", ",")}%`], ["Links internos", report.stats.internalLinks], ["Frases longas", `${report.stats.longSentencesPct}%`]] as const).map(([k, v]) => (
                      <span key={k} className="flex flex-col gap-0.5 rounded-lg bg-white/4 py-1.5">
                        <span className="text-sm font-bold text-white">{v}</span>
                        {k}
                      </span>
                    ))}
                  </div>
                )}
                <ScrollArea className="h-[min(52vh,460px)] pr-3">
                  <div className="flex flex-col gap-3">
                    {GROUPS.map(([g, title]) => {
                      const items = report?.checks.filter((c) => c.group === g) ?? []
                      if (!items.length) return null
                      return (
                        <div key={g} className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-semibold tracking-widest text-[#9C8AA6] uppercase">{title}</span>
                          {items.map((c) => {
                            const [Icon, color] = CHECK_ICON[c.status]
                            return (
                              <span key={c.id} className="flex gap-2 text-xs">
                                <Icon className="mt-px size-3.5 shrink-0" style={{ color }} />
                                <span><span className="font-semibold">{c.label}.</span> <span className="text-muted-foreground">{c.message}</span></span>
                              </span>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="bg-white/3">
              <CardHeader>
                <CardTitle>Como aparece no Google</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-0.5 rounded-lg bg-white p-3 text-[#202124]">
                  <span className="truncate text-xs text-[#4d5156]">{report?.preview.url ?? "/post/" + e.slug}</span>
                  <span className="text-base leading-[1.3] text-[#1a0dab]">{report?.preview.title || e.title || "Título do post"}</span>
                  <span className="text-xs leading-[1.45] text-[#4d5156]">{report?.preview.description || "Escreva um resumo ou meta description para aparecer aqui."}</span>
                </div>
                <FormField label="Palavra-chave principal" htmlFor="focus" hint="O termo que as pessoas buscariam para achar este post">
                  <Input id="focus" className="h-9" value={e.focus} onChange={(ev) => set({ focus: ev.target.value })} placeholder="Ex.: interestelar resenha" />
                </FormField>
                <FormField label="Endereço (slug)" htmlFor="slug">
                  <div className="flex items-center rounded-lg border border-input bg-input/30 pl-2.5 focus-within:border-ring">
                    <span className="text-xs text-[#9C8AA6]">/post/</span>
                    <input id="slug" value={e.slug} onChange={(ev) => set({ slug: ev.target.value, slugEdited: true })} placeholder="gerado a partir do título" className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-white/35" />
                  </div>
                </FormField>
                <FormField label="Meta title" htmlFor="metaTitle" aside={<Counter value={e.metaTitle.length} max={60} />}>
                  <Input id="metaTitle" className="h-9" value={e.metaTitle} onChange={(ev) => set({ metaTitle: ev.target.value })} placeholder={e.title || "Igual ao título"} />
                </FormField>
                <FormField label="Meta description" htmlFor="metaDesc" aside={<Counter value={e.metaDesc.length} max={160} />}>
                  <Textarea id="metaDesc" rows={2} value={e.metaDesc} onChange={(ev) => set({ metaDesc: ev.target.value })} placeholder={e.excerpt || "Resumo para o Google"} />
                </FormField>
                <details className="group rounded-lg border border-border px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Avançado: canônica e indexação</summary>
                  <div className="mt-3 flex flex-col gap-3">
                    <FormField label="URL canônica" htmlFor="canonical">
                      <Input id="canonical" className="h-9" value={e.canonical} onChange={(ev) => set({ canonical: ev.target.value })} placeholder="Deixe vazio para usar a URL do post" />
                    </FormField>
                    {([["index", "Indexar no Google"], ["follow", "Seguir links (follow)"]] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <Label htmlFor={key} className="text-sm">{label}</Label>
                        <Switch id={key} checked={e[key]} onCheckedChange={(v) => set({ [key]: v })} />
                      </div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 5. PUBLICAR */}
          <TabsContent value="publicar" className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <Card className="bg-white/3">
              <CardHeader>
                <CardTitle>Revisão final</CardTitle>
                <CardDescription>Confira antes de enviar. Clique num item para ir até a etapa.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {([
                  ["escrever", !!e.title.trim(), "Título", e.title.trim() || "Sem título"],
                  ["escrever", words >= 150, "Texto", `${words} palavras · ${readTime} de leitura`],
                  ["midia", !!e.coverId, "Imagem destacada", e.coverId ? "Definida" : "Nenhuma imagem"],
                  ["midia", !!e.tmdb, "Filme/série (TMDB)", e.tmdb ? "Vinculado" : "Opcional"],
                  ["detalhes", !!e.categoryId, "Categoria", root ? `${root.name}${subOpts.find((s) => s.id === e.subcategoryId) ? " › " + subOpts.find((s) => s.id === e.subcategoryId)!.name : ""}` : "Sem categoria"],
                  ["detalhes", e.tags.length > 0, "Tags", e.tags.length ? e.tags.map((t) => "#" + t).join(" ") : "Nenhuma"],
                  ["detalhes", e.authorRating != null, "Sua nota", e.authorRating != null ? `${fmtRating(e.authorRating)}/10` : "Opcional"],
                  ["seo", score >= 65, "SEO", report ? `${score}/100` : "Analisando..."],
                ] as [StepKey, boolean, string, string][]).map(([target, ok, label, value]) => (
                  <button
                    key={label}
                    onClick={() => setStep(target)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/5"
                  >
                    {ok ? <CircleCheck className="size-4 shrink-0 text-dp-green" /> : <CircleAlert className="size-4 shrink-0 text-dp-yellow" />}
                    <span className="w-36 shrink-0 text-sm font-medium">{label}</span>
                    <span className="min-w-0 truncate text-sm text-muted-foreground">{value}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white/3">
              <CardHeader>
                <CardTitle>{published ? "Post no ar" : "Como publicar"}</CardTitle>
                <CardDescription>
                  {published ? "As alterações entram no site assim que você atualizar." : "Escolha quando o post vai ao ar."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {published ? (
                  <>
                    <Button size="lg" className="h-11 rounded-full font-semibold" disabled={saving} onClick={() => save("Publicado")}>
                      Atualizar post
                    </Button>
                    <Button variant="outline" disabled={saving} onClick={() => window.confirm("Tirar o post do ar e salvar como rascunho?") && save("Rascunho")}>
                      Tirar do ar (voltar para rascunho)
                    </Button>
                  </>
                ) : (
                  <>
                    <ToggleGroup
                      value={[publishMode]}
                      onValueChange={(v) => v[0] && setPublishMode(v[0] as typeof publishMode)}
                      variant="outline"
                      className="grid w-full grid-cols-3"
                    >
                      {can("publish") && <ToggleGroupItem value="now" className="data-pressed:border-dp-yellow data-pressed:text-dp-yellow">Agora</ToggleGroupItem>}
                      {can("schedule") && <ToggleGroupItem value="schedule" className="data-pressed:border-dp-yellow data-pressed:text-dp-yellow">Agendar</ToggleGroupItem>}
                      <ToggleGroupItem value="review" className="data-pressed:border-dp-yellow data-pressed:text-dp-yellow">Revisão</ToggleGroupItem>
                    </ToggleGroup>

                    {publishMode === "schedule" && (
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Data" htmlFor="date">
                          <Input id="date" type="date" className="h-9 scheme-dark" value={e.date} onChange={(ev) => set({ date: ev.target.value })} />
                        </FormField>
                        <FormField label="Hora" htmlFor="time">
                          <Input id="time" type="time" className="h-9 scheme-dark" value={e.time} onChange={(ev) => set({ time: ev.target.value })} />
                        </FormField>
                        <FormField label="Fuso horário" className="col-span-2">
                          <Select value={e.tz} onValueChange={(v) => v && set({ tz: v })} items={TIMEZONES.map((t) => ({ value: t, label: t }))}>
                            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </FormField>
                      </div>
                    )}

                    <p className="m-0 text-xs text-muted-foreground">
                      {publishMode === "now" ? "O post entra no ar imediatamente."
                        : publishMode === "schedule" ? `Vai ao ar em ${fmtDate(e.date)} às ${e.time} (${e.tz}).`
                        : "Um editor revisa antes de publicar."}
                    </p>
                    <Button
                      size="lg"
                      className="h-11 rounded-full font-semibold"
                      disabled={saving}
                      onClick={() => save(publishMode === "now" ? "Publicado" : publishMode === "schedule" ? "Agendado" : "Em revisão")}
                    >
                      {publishMode === "now" ? "Publicar agora" : publishMode === "schedule" ? "Agendar publicação" : "Enviar para revisão"}
                    </Button>
                    <Button variant="ghost" disabled={saving} onClick={() => save("Rascunho")}>Só salvar como rascunho</Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Navegação entre etapas */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="ghost" disabled={stepIndex === 0} onClick={() => go(-1)}>
            <ArrowLeft /> {stepIndex > 0 ? STEPS[stepIndex - 1].label : "Voltar"}
          </Button>
          <span className="text-xs text-muted-foreground">Etapa {stepIndex + 1} de {STEPS.length}</span>
          {stepIndex < STEPS.length - 1 ? (
            <Button variant="outline" onClick={() => go(1)}>
              {STEPS[stepIndex + 1].label} <ArrowRight />
            </Button>
          ) : (
            <span className="w-24" />
          )}
        </div>
      </div>

      {/* Prévia */}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[92vh] w-[min(940px,96vw)] max-w-none gap-3 overflow-y-auto border-border bg-dp-deep p-4 sm:max-w-none">
          <DialogHeader className="flex-row items-center justify-between gap-3">
            <DialogTitle>Prévia do post</DialogTitle>
            <ToggleGroup value={[device]} onValueChange={(v) => v[0] && setDevice(v[0] as "desktop" | "mobile")} variant="outline" size="sm" className="mr-8">
              <ToggleGroupItem value="desktop" aria-label="Computador"><Monitor /></ToggleGroupItem>
              <ToggleGroupItem value="mobile" aria-label="Celular"><Smartphone /></ToggleGroupItem>
            </ToggleGroup>
          </DialogHeader>
          <div className="mx-auto w-full overflow-hidden rounded-[20px] border border-white/20 bg-dp-bg transition-[max-width] duration-300" style={{ maxWidth: device === "mobile" ? 390 : 900 }}>
            <div className="h-60" style={{ background: e.coverUrl ? thumbBg(e.coverUrl) : "rgba(255,255,255,.03)" }} />
            <div className="flex flex-col gap-3 px-[clamp(16px,4vw,48px)] pt-6 pb-10">
              <span className="inline-flex h-6.5 items-center self-start rounded-full px-3 text-xs font-semibold text-dp-bg" style={{ background: CAT_COLOR[kind] }}>{kind}</span>
              <h1 className="m-0 font-display leading-[1.02] font-normal" style={{ fontSize: device === "mobile" ? 32 : 52 }}>{e.title || "Título do post"}</h1>
              <span className="text-[13px] text-muted-foreground">{authors.find((a) => a.id === e.authorId)?.name} · {readTime} de leitura</span>
              {(e.subtitle || e.excerpt) && <p className="m-0 text-[15px] text-dp-lilac">{e.subtitle || e.excerpt}</p>}
              <div className="rich-text mt-2" dangerouslySetInnerHTML={{ __html: e.html }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
