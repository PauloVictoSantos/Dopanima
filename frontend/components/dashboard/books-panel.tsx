"use client"

import { useEffect, useState } from "react"
import { toast } from "@/lib/toast"
import { BookOpen, ExternalLink, ImageDown, Search, Star, Wand2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { errorMessage } from "@/lib/api"
import { booksApi, type BookCard, type BookDetails, type BookField } from "@/lib/dashboard-api"
import { thumbBg } from "@/lib/dashboard"

const FIELD_ITEMS = [
  { value: "all", label: "Tudo" },
  { value: "title", label: "Título" },
  { value: "author", label: "Autor" },
  { value: "isbn", label: "ISBN" },
]

export type BookFill = { title: string; subtitle: string; description: string; authors: string[] }

/**
 * Painel do editor: vincula o post de livro a um volume do Google Books, preenche
 * título/autor/resumo e importa a capa para a biblioteca de mídia (vira a imagem destacada).
 */
export function BooksPanel({
  value,
  onChange,
  onCover,
  onFill,
  onDetails,
  canImport,
}: {
  value: string | null
  onChange: (id: string | null) => void
  onCover: (media: { id: number; url: string }) => void
  onFill: (data: BookFill) => void
  /** Avisa quando a ficha do livro vinculado carrega (ex.: para comparar notas). */
  onDetails?: (d: BookDetails | null) => void
  canImport: boolean
}) {
  const [keyed, setKeyed] = useState<boolean | null>(null)
  const [q, setQ] = useState("")
  const [field, setField] = useState<BookField>("all")
  const [results, setResults] = useState<BookCard[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [details, setDetails] = useState<BookDetails | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    booksApi.status().then((s) => setKeyed(s.keyed)).catch(() => setKeyed(null))
  }, [])

  // Carrega a ficha do livro vinculado.
  useEffect(() => {
    if (!value) return
    let alive = true
    booksApi
      .details(value)
      .then((d) => alive && setDetails(d))
      .catch((e) => toast.error(errorMessage(e)))
    return () => {
      alive = false
    }
  }, [value])

  const d = details && details.id === value ? details : null

  // Repassa a ficha atual (ou null) para quem usa o painel.
  const dKey = d?.id ?? ""
  useEffect(() => {
    onDetails?.(d)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dKey identifies the loaded book
  }, [dKey])

  const search = async () => {
    if (!q.trim()) return
    setSearching(true)
    try {
      setResults((await booksApi.search(q.trim(), field)).items)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSearching(false)
    }
  }

  const importCover = async () => {
    if (!value) return
    setImporting(true)
    try {
      const m = await booksApi.importCover(value)
      onCover({ id: m.id, url: m.url })
      toast.success(m.reused ? "Capa já estava na biblioteca: definida como destaque" : "Capa importada para a biblioteca e definida como destaque")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card className="bg-white/3">
      <CardHeader>
        <CardTitle>Livro (Google Books)</CardTitle>
        <CardDescription>
          {value
            ? "Ficha do livro e mais obras do autor aparecem no post."
            : "Vincule o post a um livro para preencher os dados, importar a capa e mostrar a ficha."}
          {keyed === false && " Sem GOOGLE_BOOKS_API_KEY no .env da API, o Google costuma recusar as buscas por limite de uso."}
        </CardDescription>
        {value && (
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                onChange(null)
                setDetails(null)
              }}
            >
              <X /> Desvincular
            </Button>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {value ? (
          d ? (
            <div className="flex gap-3">
              <span className="aspect-2/3 w-20 shrink-0 rounded-lg" style={{ background: thumbBg(d.cover) }} />
              <div className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground">
                <span className="text-sm font-semibold text-white">
                  {d.title} {d.year && <span className="font-normal text-muted-foreground">({d.year})</span>}
                </span>
                {d.subtitle && <span className="line-clamp-2">{d.subtitle}</span>}
                <span>{d.authors.join(", ") || "Autor desconhecido"}</span>
                <span className="flex flex-wrap gap-1">
                  {d.categories.slice(0, 2).map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                  {d.pageCount && <Badge variant="outline">{d.pageCount} págs.</Badge>}
                </span>
                {d.rating > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3 text-dp-yellow" fill="currentColor" aria-hidden /> {(d.rating / 2).toLocaleString("pt-BR")}/5 · {d.votes} avaliações
                  </span>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="xs" onClick={() => onFill({ title: d.title, subtitle: d.subtitle, description: d.description, authors: d.authors })}>
                    <Wand2 /> Usar dados do livro
                  </Button>
                  {canImport && d.cover && (
                    <Button variant="outline" size="xs" onClick={importCover} disabled={importing}>
                      <ImageDown /> {importing ? "Importando..." : "Usar capa"}
                    </Button>
                  )}
                  <Button variant="ghost" size="xs" nativeButton={false} render={<a href={d.url} target="_blank" rel="noreferrer" />}>
                    Google Books <ExternalLink />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Carregando ficha...</span>
          )
        ) : (
          <>
            <form
              className="flex gap-1.5"
              onSubmit={(ev) => {
                ev.preventDefault()
                void search()
              }}
            >
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, autor ou ISBN" aria-label="Buscar no Google Books" className="h-9 flex-1" />
              <Select value={field} onValueChange={(v) => v && setField(v as BookField)} items={FIELD_ITEMS}>
                <SelectTrigger className="h-9 w-28" aria-label="Buscar por"><SelectValue /></SelectTrigger>
                <SelectContent>{FIELD_ITEMS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="submit" size="icon-lg" disabled={searching} aria-label="Buscar">
                <Search />
              </Button>
            </form>
            {results && (
              <ScrollArea className="h-72">
                <div className="flex flex-col gap-0.5 pr-3">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        onChange(r.id)
                        setResults(null)
                        setQ("")
                      }}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-white/6"
                    >
                      <span className="aspect-2/3 w-9 shrink-0 rounded" style={{ background: thumbBg(r.cover) }} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[13px] font-semibold text-white">{r.title}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <BookOpen className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{[r.authors.join(", "), r.year].filter(Boolean).join(" · ")}</span>
                          {r.postSlug && <Badge className="h-4 shrink-0 bg-dp-green/20 px-1.5 text-[10px] text-dp-green">já tem post</Badge>}
                        </span>
                      </span>
                    </button>
                  ))}
                  {!results.length && <span className="p-2 text-xs text-muted-foreground">Nada encontrado.</span>}
                </div>
              </ScrollArea>
            )}
          </>
        )}
        <span className="text-[10px] text-[#9C8AA6]">Dados e capas: Google Books</span>
      </CardContent>
    </Card>
  )
}
