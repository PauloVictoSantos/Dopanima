"use client"

import { useEffect, useState } from "react"
import { toast } from "@/lib/toast"
import { BookCheck, ExternalLink, FileSearch, Newspaper, PenLine, Scissors, Sparkles, SpellCheck, Wand2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/api"
import { aiApi, type AiContext, type AiFill, type AiNews, type AiSource, type AiStatus } from "@/lib/dashboard-api"

/** Texto vindo do modelo vira HTML só depois de escapado (o backend também sanitiza ao salvar). */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const sourcesHtml = (list: AiSource[]) =>
  `<h3>Fontes</h3><ul>${list.map((s) => `<li><a href="${esc(s.url)}" target="_blank">${esc(s.title)}</a></li>`).join("")}</ul>`

const hasText = (html: string) => html.replace(/<[^>]+>/g, "").trim().length > 0

function Sources({ list }: { list: AiSource[] }) {
  if (!list.length) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-widest text-[#9C8AA6] uppercase">Fontes consultadas</span>
      {list.map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-dp-lilac hover:underline">
          <ExternalLink className="size-3 shrink-0" aria-hidden /> <span className="truncate">{s.title}</span>
        </a>
      ))}
    </div>
  )
}

/**
 * Assistente de escrita (Gemini) do editor de posts. Tudo passa pela API do blog,
 * que guarda a chave e conta o limite diário de cada pessoa.
 */
export function AiAssistant({
  open,
  onOpenChange,
  ctx,
  getHtml,
  onReplace,
  onAppend,
  onFill,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ctx: AiContext
  /** HTML atual do corpo do post. */
  getHtml: () => string
  /** Troca o corpo inteiro (o editor oferece "Desfazer"). */
  onReplace: (html: string, label: string) => void
  /** Acrescenta ao fim do corpo. */
  onAppend: (html: string, label: string) => void
  onFill: (f: AiFill, overwrite: boolean) => void
}) {
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [fill, setFill] = useState<AiFill | null>(null)
  const [refs, setRefs] = useState<{ summary: string; sources: AiSource[] } | null>(null)
  const [query, setQuery] = useState("")
  const [news, setNews] = useState<{ items: AiNews[]; summary: string; sources: AiSource[] } | null>(null)

  const refresh = () => aiApi.status().then(setStatus).catch(() => setStatus(null))
  useEffect(() => {
    if (open) void refresh()
  }, [open])

  /** Roda um pedido, mostra erro amigável e atualiza o contador do dia. */
  const run = async <T,>(key: string, fn: () => Promise<T>) => {
    setBusy(key)
    try {
      return await fn()
    } catch (e) {
      toast.error(errorMessage(e))
      return null
    } finally {
      setBusy(null)
      void refresh()
    }
  }

  const disabled = !!busy || !status?.enabled || status.remaining <= 0
  const wait = (key: string, label: string) => (busy === key ? "Gerando..." : label)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(460px,94vw)] gap-0 border-white/15 bg-dp-panel p-0 text-white sm:max-w-none">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle className="flex items-center gap-2 text-white">
            <Sparkles className="size-4 text-dp-yellow" aria-hidden /> Assistente de IA
          </SheetTitle>
          <SheetDescription>
            {status === null
              ? "Carregando..."
              : !status.enabled
                ? "Desligado: defina GEMINI_API_KEY no .env da API."
                : `${status.used} de ${status.limit} pedidos usados hoje · ${status.remaining} restantes`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <Tabs defaultValue="escrever" className="gap-4 p-5">
            <TabsList className="w-full">
              <TabsTrigger value="escrever" className="text-xs">Escrever</TabsTrigger>
              <TabsTrigger value="revisar" className="text-xs">Revisar</TabsTrigger>
              <TabsTrigger value="seo" className="text-xs">SEO</TabsTrigger>
              <TabsTrigger value="pesquisa" className="text-xs">Pesquisa</TabsTrigger>
            </TabsList>

            {/* ESCREVER */}
            <TabsContent value="escrever" className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                O que o texto deve abordar (opcional)
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={3000}
                  rows={5}
                  placeholder="Ex.: resenha sem spoilers, destacar a trilha sonora e comparar com o livro"
                />
              </label>
              <Button
                disabled={disabled || !ctx.title.trim()}
                onClick={async () => {
                  const r = await run("draft", () => aiApi.draft({ ...ctx, notes }))
                  if (!r) return
                  if (hasText(getHtml())) onAppend(r.html, "Rascunho adicionado ao fim do texto")
                  else onReplace(r.html, "Rascunho gerado")
                }}
              >
                <PenLine /> {wait("draft", "Gerar rascunho a partir do título")}
              </Button>
              {!ctx.title.trim() && <span className="text-xs text-muted-foreground">Escreva o título do post primeiro.</span>}
              <Button
                variant="outline"
                disabled={disabled}
                onClick={async () => {
                  const r = await run("continue", () => aiApi.continue({ ...ctx, html: getHtml() }))
                  if (r) onAppend(r.html, "Continuação adicionada ao fim do texto")
                }}
              >
                <Wand2 /> {wait("continue", "Continuar o texto")}
              </Button>
            </TabsContent>

            {/* REVISAR */}
            <TabsContent value="revisar" className="flex flex-col gap-2">
              <p className="m-0 text-xs text-muted-foreground">Revisa o texto inteiro do post. Dá para desfazer logo depois.</p>
              {(
                [
                  ["fix", SpellCheck, "Corrigir ortografia e gramática", "Texto corrigido"],
                  ["improve", Sparkles, "Melhorar a escrita", "Texto reescrito"],
                  ["shorten", Scissors, "Encurtar o texto", "Texto encurtado"],
                ] as const
              ).map(([mode, Icon, label, done]) => (
                <Button
                  key={mode}
                  variant={mode === "fix" ? "default" : "outline"}
                  disabled={disabled}
                  onClick={async () => {
                    const html = getHtml()
                    if (!hasText(html)) return toast.error("O texto está vazio.")
                    const r = await run(mode, () => aiApi.edit(mode, html))
                    if (r) onReplace(r.html, done)
                  }}
                >
                  <Icon /> {wait(mode, label)}
                </Button>
              ))}
            </TabsContent>

            {/* SEO */}
            <TabsContent value="seo" className="flex flex-col gap-3">
              <p className="m-0 text-xs text-muted-foreground">Sugere subtítulo, resumo, tags e os campos de SEO a partir do texto.</p>
              <Button
                disabled={disabled}
                onClick={async () => {
                  const r = await run("fill", () => aiApi.fill({ ...ctx, html: getHtml() }))
                  if (r) setFill(r)
                }}
              >
                <Wand2 /> {wait("fill", "Gerar sugestões")}
              </Button>
              {fill && (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-xs">
                  {(
                    [
                      ["Subtítulo", fill.subtitle],
                      ["Resumo", fill.excerpt],
                      ["Palavra-chave", fill.focusKeyword],
                      ["Título SEO", fill.metaTitle],
                      ["Descrição SEO", fill.metaDescription],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="text-[#9C8AA6]">{k}</span>
                      <span>{v || "—"}</span>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1">
                    {fill.tags.map((t) => <Badge key={t} variant="secondary">#{t}</Badge>)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onFill(fill, false)}>Preencher campos vazios</Button>
                    <Button size="sm" variant="outline" onClick={() => onFill(fill, true)}>Substituir tudo</Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* PESQUISA */}
            <TabsContent value="pesquisa" className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Referências</span>
                <p className="m-0 text-xs text-muted-foreground">Busca na web fontes que confirmem o que o post diz e aponta o que precisa de checagem.</p>
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={async () => {
                    const r = await run("refs", () => aiApi.references({ ...ctx, html: getHtml() }))
                    if (r) setRefs(r)
                  }}
                >
                  <BookCheck /> {wait("refs", "Buscar referências")}
                </Button>
                {refs && (
                  <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-xs">
                    <p className="m-0 whitespace-pre-line text-dp-body">{refs.summary}</p>
                    <Sources list={refs.sources} />
                    {refs.sources.length > 0 && (
                      <Button size="sm" variant="outline" className="self-start" onClick={() => onAppend(sourcesHtml(refs.sources), "Fontes adicionadas ao fim do texto")}>
                        Inserir fontes no fim do texto
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <span className="text-sm font-semibold">Procurar notícias</span>
                <form
                  className="flex gap-1.5"
                  onSubmit={async (ev) => {
                    ev.preventDefault()
                    if (!query.trim()) return
                    const r = await run("news", () => aiApi.news(query.trim()))
                    if (r) setNews(r)
                  }}
                >
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={200} placeholder="Ex.: segunda temporada de The Last of Us" className="h-9 flex-1" aria-label="Assunto da notícia" />
                  <Button type="submit" size="icon-lg" disabled={disabled} aria-label="Procurar notícias">
                    {busy === "news" ? <FileSearch className="animate-pulse" /> : <Newspaper />}
                  </Button>
                </form>
                {news && (
                  <div className="flex flex-col gap-2">
                    {!news.items.length && <p className="m-0 text-xs whitespace-pre-line text-muted-foreground">{news.summary || "Nenhuma notícia recente encontrada."}</p>}
                    {news.items.map((n, i) => (
                      <div key={i} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-xs">
                        <span className="text-sm font-semibold text-white">{n.headline}</span>
                        <span className="text-[#9C8AA6]">{[n.outlet, n.date].filter(Boolean).join(" · ")}</span>
                        <p className="m-0 text-dp-body">{n.summary}</p>
                        <Button
                          size="xs"
                          variant="outline"
                          className="mt-1 self-start"
                          onClick={() => onAppend(`<h2>${esc(n.headline)}</h2><p>${esc(n.summary)}</p>`, "Notícia adicionada ao fim do texto")}
                        >
                          Inserir no texto
                        </Button>
                      </div>
                    ))}
                    <Sources list={news.sources} />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>
        <p className="m-0 border-t border-border px-5 py-3 text-[11px] text-[#9C8AA6]">
          Texto gerado por IA (Gemini) pode conter erros. Revise fatos, nomes e datas antes de publicar.
        </p>
      </SheetContent>
    </Sheet>
  )
}
