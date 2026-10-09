"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ExternalLink, Film, Search, Star, Tv, Wand2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { errorMessage } from "@/lib/api"
import { tmdbApi, type TmdbCard, type TmdbDetails, type TmdbImage, type TmdbType } from "@/lib/dashboard-api"
import { thumbBg } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

type Link = { id: number; type: TmdbType } | null

const TYPE_ITEMS = [
  { value: "all", label: "Tudo" },
  { value: "movie", label: "Filmes" },
  { value: "tv", label: "Séries" },
]

/**
 * Painel do editor: vincula o post a um filme/série da TMDB e importa pôster ou
 * cena para a biblioteca de mídia (vira a imagem destacada).
 */
export function TmdbPanel({
  value,
  onChange,
  onCover,
  onFill,
  onDetails,
  canImport,
}: {
  value: Link
  onChange: (v: Link) => void
  onCover: (media: { id: number; url: string }) => void
  onFill: (data: { title: string; overview: string; tagline: string }) => void
  /** Avisa quando a ficha do título vinculado carrega (ex.: para comparar notas). */
  onDetails?: (d: TmdbDetails | null) => void
  canImport: boolean
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [q, setQ] = useState("")
  const [type, setType] = useState<TmdbType | "all">("all")
  const [results, setResults] = useState<TmdbCard[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [details, setDetails] = useState<TmdbDetails | null>(null)
  const [importing, setImporting] = useState<string | null>(null)

  useEffect(() => {
    tmdbApi.status().then((s) => setEnabled(s.enabled)).catch(() => setEnabled(false))
  }, [])

  // Carrega a ficha do título vinculado.
  const key = value ? `${value.type}:${value.id}` : ""
  useEffect(() => {
    if (!value || !enabled) return
    let alive = true
    tmdbApi
      .details(value.type, value.id)
      .then((d) => alive && setDetails(d))
      .catch((e) => toast.error(errorMessage(e)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key identifies the linked title
  }, [key, enabled])

  const d = details && value && details.id === value.id && details.type === value.type ? details : null

  // Repassa a ficha atual (ou null) para quem usa o painel.
  const dKey = d ? `${d.type}:${d.id}` : ""
  useEffect(() => {
    onDetails?.(d)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dKey identifies the loaded title
  }, [dKey])

  const search = async () => {
    if (!q.trim()) return
    setSearching(true)
    try {
      setResults((await tmdbApi.search(q.trim(), type)).items)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSearching(false)
    }
  }

  const importImage = async (path: string, kind: "poster" | "backdrop") => {
    if (!value) return
    setImporting(path)
    try {
      const m = await tmdbApi.importImage(value.type, value.id, path, kind)
      onCover({ id: m.id, url: m.url })
      toast.success(m.reused ? "Imagem já estava na biblioteca: definida como destaque" : "Imagem importada para a biblioteca e definida como destaque")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setImporting(null)
    }
  }

  const gallery = (list: TmdbImage[], kind: "poster" | "backdrop") => (
    <ScrollArea className="h-56">
      <div className={cn("grid gap-1.5 pr-3", kind === "poster" ? "grid-cols-4" : "grid-cols-2")}>
        {list.map((img) => (
          <button
            key={img.path}
            onClick={() => importImage(img.path, kind)}
            disabled={!!importing}
            aria-label={`Usar ${kind === "poster" ? "pôster" : "cena"} ${img.lang ? `(${img.lang})` : ""}`}
            className={cn(
              "relative cursor-pointer rounded-md border-2 border-transparent p-0 hover:border-dp-yellow disabled:cursor-wait",
              kind === "poster" ? "aspect-2/3" : "aspect-video",
              importing === img.path && "animate-pulse border-dp-yellow"
            )}
            style={{ background: thumbBg(img.url) }}
          >
            {img.lang && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-semibold uppercase">{img.lang}</span>}
          </button>
        ))}
        {!list.length && <span className="col-span-full text-xs text-muted-foreground">Nenhuma imagem disponível.</span>}
      </div>
    </ScrollArea>
  )

  return (
    <Card className="bg-white/3">
      <CardHeader>
        <CardTitle>Filme ou série (TMDB)</CardTitle>
        <CardDescription>
          {enabled === false
            ? "Integração desligada: defina TMDB_TOKEN no .env da API."
            : value
              ? "Ficha técnica, onde assistir e recomendações aparecem no post."
              : "Vincule o post a um título para mostrar ficha técnica e onde assistir."}
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

      {enabled !== false && (
        <CardContent className="flex flex-col gap-3">
          {value ? (
            d ? (
              <>
                <div className="flex gap-3">
                  <span className="aspect-2/3 w-20 shrink-0 rounded-lg" style={{ background: thumbBg(d.poster) }} />
                  <div className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground">
                    <span className="text-sm font-semibold text-white">
                      {d.title} {d.year && <span className="font-normal text-muted-foreground">({d.year})</span>}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant="outline">{d.type === "movie" ? "Filme" : "Série"}</Badge>
                      {d.genres.slice(0, 2).map((g) => <Badge key={g} variant="secondary">{g}</Badge>)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3 text-dp-yellow" fill="currentColor" aria-hidden /> {d.rating.toLocaleString("pt-BR")} · {d.directors.slice(0, 2).join(", ") || "—"}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" size="xs" onClick={() => onFill({ title: d.title, overview: d.overview, tagline: d.tagline })}>
                        <Wand2 /> Usar título e sinopse
                      </Button>
                      <Button variant="ghost" size="xs" nativeButton={false} render={<a href={d.tmdbUrl} target="_blank" rel="noreferrer" />}>
                        TMDB <ExternalLink />
                      </Button>
                    </div>
                  </div>
                </div>
                {canImport && (
                  <Tabs defaultValue="posters" className="gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <TabsList>
                        <TabsTrigger value="posters" className="px-2.5 text-xs">Pôsteres ({d.images.posters.length})</TabsTrigger>
                        <TabsTrigger value="backdrops" className="px-2.5 text-xs">Cenas ({d.images.backdrops.length})</TabsTrigger>
                      </TabsList>
                      <span className="text-[11px] text-muted-foreground">Clique para usar como capa</span>
                    </div>
                    <TabsContent value="posters">{gallery(d.images.posters, "poster")}</TabsContent>
                    <TabsContent value="backdrops">{gallery(d.images.backdrops, "backdrop")}</TabsContent>
                  </Tabs>
                )}
              </>
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
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar filme ou série" aria-label="Buscar na TMDB" className="h-9 flex-1" />
                <Select value={type} onValueChange={(v) => v && setType(v as TmdbType | "all")} items={TYPE_ITEMS}>
                  <SelectTrigger className="h-9 w-28" aria-label="Tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPE_ITEMS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
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
                        key={`${r.type}-${r.id}`}
                        onClick={() => {
                          onChange({ id: r.id, type: r.type })
                          setResults(null)
                          setQ("")
                        }}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-white/6"
                      >
                        <span className="aspect-2/3 w-9 shrink-0 rounded" style={{ background: thumbBg(r.poster) }} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-[13px] font-semibold text-white">{r.title}</span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {r.type === "movie" ? <Film className="size-3" aria-hidden /> : <Tv className="size-3" aria-hidden />}
                            {r.type === "movie" ? "Filme" : "Série"} {r.year && `· ${r.year}`}
                            {r.postSlug && <Badge className="h-4 bg-dp-green/20 px-1.5 text-[10px] text-dp-green">já tem post</Badge>}
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
          <span className="text-[10px] text-[#9C8AA6]">Dados e imagens: TMDB</span>
        </CardContent>
      )}
    </Card>
  )
}
