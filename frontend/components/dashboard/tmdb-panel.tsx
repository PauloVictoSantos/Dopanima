"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ExternalLink, Film, Search, Star, Tv } from "lucide-react"
import { Panel, inputCls, pillCls, selectCls } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { tmdbApi, type TmdbCard, type TmdbDetails, type TmdbType } from "@/lib/dashboard-api"
import { thumbBg } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

type Link = { id: number; type: TmdbType } | null

const small = "h-7.5 cursor-pointer rounded-full border px-3 text-xs font-semibold whitespace-nowrap"

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
  const [tab, setTab] = useState<"posters" | "backdrops">("posters")
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

  const d = details && value && details.id === value.id && details.type === value.type ? details : null

  // Repassa a ficha atual (ou null) para quem usa o painel.
  const dKey = d ? `${d.type}:${d.id}` : ""
  useEffect(() => {
    onDetails?.(d)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dKey identifies the loaded title
  }, [dKey])

  if (enabled === false)
    return (
      <Panel className="gap-2 p-4.5">
        <h2 className="m-0 text-[15px] font-semibold">Filme ou série (TMDB)</h2>
        <p className="m-0 text-xs leading-normal text-dp-muted">Integração desligada. Defina <code>TMDB_TOKEN</code> no <code>.env</code> da API para buscar capas, fichas técnicas e sugestões.</p>
      </Panel>
    )

  const gallery = d ? (tab === "posters" ? d.images.posters : d.images.backdrops) : []

  return (
    <Panel className="gap-3 p-4.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-[15px] font-semibold">Filme ou série (TMDB)</h2>
        {value && (
          <button
            onClick={() => {
              onChange(null)
              setDetails(null)
            }}
            className={cn(small, "border-[#FF8A73]/50 text-[#FF8A73]")}
          >
            Desvincular
          </button>
        )}
      </div>

      {value ? (
        d ? (
          <>
            <div className="flex gap-3">
              <span className="aspect-2/3 w-20 shrink-0 rounded-lg" style={{ background: thumbBg(d.poster) }} />
              <span className="flex min-w-0 flex-col gap-1 text-xs text-dp-muted">
                <span className="text-sm font-semibold text-white">
                  {d.title} {d.year && <span className="font-normal text-dp-muted">({d.year})</span>}
                </span>
                <span>
                  {d.type === "movie" ? "Filme" : "Série"} · {d.genres.slice(0, 3).join(", ")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3 text-dp-yellow" fill="currentColor" aria-hidden /> {d.rating.toLocaleString("pt-BR")} · {d.directors.slice(0, 2).join(", ") || "—"}
                </span>
                <a href={d.tmdbUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-dp-lilac">
                  Ver na TMDB <ExternalLink className="size-3" aria-hidden />
                </a>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => onFill({ title: d.title, overview: d.overview, tagline: d.tagline })} className={cn(small, "border-white/30 text-white hover:border-dp-yellow hover:text-dp-yellow")}>
                Usar título e sinopse
              </button>
            </div>
            {canImport && (
              <>
                <div className="flex gap-1.5">
                  {(["posters", "backdrops"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={pillCls(tab === t) + " h-7.5 px-3 text-xs"}>
                      {t === "posters" ? `Pôsteres (${d.images.posters.length})` : `Cenas (${d.images.backdrops.length})`}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-dp-muted">Clique numa imagem para usar como destaque (ela vai para a biblioteca de mídia).</span>
                <div className={cn("grid gap-1.5", tab === "posters" ? "grid-cols-4" : "grid-cols-2")}>
                  {gallery.map((img) => (
                    <button
                      key={img.path}
                      onClick={() => importImage(img.path, tab === "posters" ? "poster" : "backdrop")}
                      disabled={!!importing}
                      aria-label={`Usar ${tab === "posters" ? "pôster" : "cena"} ${img.lang ? `(${img.lang})` : ""}`}
                      className={cn(
                        "relative cursor-pointer rounded-md border-2 border-transparent p-0 hover:border-dp-yellow disabled:cursor-wait",
                        tab === "posters" ? "aspect-2/3" : "aspect-video",
                        importing === img.path && "animate-pulse border-dp-yellow"
                      )}
                      style={{ background: thumbBg(img.url) }}
                    >
                      {img.lang && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-semibold uppercase">{img.lang}</span>}
                    </button>
                  ))}
                  {!gallery.length && <span className="col-span-full text-xs text-dp-muted">Nenhuma imagem disponível.</span>}
                </div>
              </>
            )}
          </>
        ) : (
          <span className="text-xs text-dp-muted">Carregando ficha...</span>
        )
      ) : (
        <>
          <span className="text-xs leading-normal text-dp-muted">Vincule o post a um título para mostrar ficha técnica, onde assistir e recomendações no site.</span>
          <div className="flex gap-1.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void search()
                }
              }}
              placeholder="Buscar filme ou série"
              aria-label="Buscar na TMDB"
              className={inputCls + " h-9.5 min-w-0 flex-1 px-3"}
            />
            <select value={type} onChange={(e) => setType(e.target.value as TmdbType | "all")} aria-label="Tipo" className={selectCls + " h-9.5 w-24"}>
              <option value="all">Tudo</option>
              <option value="movie">Filmes</option>
              <option value="tv">Séries</option>
            </select>
            <button onClick={search} disabled={searching} aria-label="Buscar" className="grid size-9.5 shrink-0 cursor-pointer place-items-center rounded-[10px] bg-dp-orange text-white disabled:opacity-60">
              <Search className="size-4" aria-hidden />
            </button>
          </div>
          {results && (
            <div className="flex max-h-90 flex-col gap-1 overflow-y-auto pr-1">
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
                    <span className="flex items-center gap-1.5 text-xs text-dp-muted">
                      {r.type === "movie" ? <Film className="size-3" aria-hidden /> : <Tv className="size-3" aria-hidden />}
                      {r.type === "movie" ? "Filme" : "Série"} {r.year && `· ${r.year}`}
                      {r.postSlug && <span className="rounded-full bg-dp-green/20 px-1.5 text-[10px] font-semibold text-dp-green">já tem post</span>}
                    </span>
                  </span>
                </button>
              ))}
              {!results.length && <span className="p-2 text-xs text-dp-muted">Nada encontrado.</span>}
            </div>
          )}
        </>
      )}
      <span className="text-[10px] text-[#9C8AA6]">Dados e imagens: TMDB</span>
    </Panel>
  )
}
