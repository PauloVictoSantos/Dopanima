import Link from "next/link"
import { ExternalLink, Play, Star } from "lucide-react"
import type { TmdbCard, TmdbDetails, TmdbProvider } from "@/lib/dashboard-api"

export type PostTmdb = Omit<TmdbDetails, "images">

const bg = (url: string, fallback = "#2A0A36") => (url ? `url("${url}") center/cover no-repeat, ${fallback}` : fallback)

export const fmtRating = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const fmtRuntime = (min: number | null) => (min ? (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`) : "")

function Providers({ label, list }: { label: string; list: TmdbProvider[] }) {
  if (!list.length) return null
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-widest text-[#9C8AA6] uppercase">{label}</span>
      <div className="flex flex-wrap gap-2">
        {list.map((p) => (
          <span key={p.id} title={p.name} className="flex items-center gap-2 rounded-full border border-white/14 bg-white/4 py-1 pr-3 pl-1 text-xs font-medium">
            <span className="size-7 rounded-full" style={{ background: bg(p.logo) }} aria-hidden />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Card de recomendação: leva para o post do blog quando existe, senão para a TMDB. */
export function TitleCardLink({ c }: { c: TmdbCard }) {
  const body = (
    <>
      <span className="relative block aspect-2/3 overflow-hidden rounded-xl border border-white/12" style={{ background: bg(c.poster) }}>
        {c.rating > 0 && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold">
            <Star className="size-3 text-dp-yellow" fill="currentColor" aria-hidden /> {c.rating.toLocaleString("pt-BR")}
          </span>
        )}
        {c.postSlug && (
          <span className="absolute right-2 bottom-2 rounded-full bg-dp-yellow px-2 py-0.5 text-[11px] font-bold text-dp-bg">
            Resenha{c.postRating != null ? ` · ${fmtRating(c.postRating)}` : ""}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-[13px] leading-[1.35] font-semibold">{c.title}</span>
      <span className="text-xs text-dp-muted">{[c.type === "movie" ? "Filme" : "Série", c.year].filter(Boolean).join(" · ")}</span>
    </>
  )
  const cls = "flex w-[150px] shrink-0 snap-start flex-col gap-2 text-white no-underline transition-transform duration-300 hover:-translate-y-1"
  return c.postSlug ? (
    <Link href={`/post/${c.postSlug}`} className={cls}>{body}</Link>
  ) : (
    <a href={c.tmdbUrl} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
  )
}

/** Nota do autor x nota do público na TMDB, com a diferença entre elas. */
function RatingCompare({ author, authorName, tmdb, votes }: { author: number; authorName: string; tmdb: number; votes: number }) {
  const diff = Math.round((author - tmdb) * 10) / 10
  const verdict =
    Math.abs(diff) < 0.5
      ? "A crítica concorda com o público."
      : diff > 0
        ? `${authorName.split(" ")[0]} gostou mais que o público: ${fmtRating(diff)} ponto(s) acima.`
        : `${authorName.split(" ")[0]} foi mais exigente que o público: ${fmtRating(-diff)} ponto(s) abaixo.`
  const bar = (v: number, color: string) => (
    <span className="block h-2 overflow-hidden rounded-full bg-white/10">
      <span className="block h-full rounded-full" style={{ width: `${v * 10}%`, background: color }} />
    </span>
  )
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dp-yellow/30 bg-dp-yellow/6 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-dp-muted">Nota de {authorName}</span>
          <span className="text-[28px] leading-none font-bold text-dp-yellow">
            {fmtRating(author)}<span className="text-sm text-dp-muted">/10</span>
          </span>
          {bar(author, "#F7E27A")}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-dp-muted">Público na TMDB · {votes.toLocaleString("pt-BR")} votos</span>
          <span className="text-[28px] leading-none font-bold">
            {fmtRating(tmdb)}<span className="text-sm text-dp-muted">/10</span>
          </span>
          {bar(tmdb, "#01B4E4")}
        </div>
      </div>
      <p className="m-0 text-sm">
        <b style={{ color: Math.abs(diff) < 0.5 ? "#fff" : diff > 0 ? "#8BE04E" : "#FF8A73" }}>
          {diff > 0 ? "+" : diff < 0 ? "−" : ""}{fmtRating(Math.abs(diff))}
        </b>{" "}
        <span className="text-dp-body">{verdict}</span>
      </p>
    </div>
  )
}

/** Ficha técnica, onde assistir, trailer e recomendações do título ligado ao post. */
export function TmdbInfo({ t, authorRating, authorName }: { t: PostTmdb; authorRating?: number | null; authorName?: string }) {
  const facts: [string, string][] = [
    ["Título original", t.originalTitle !== t.title ? t.originalTitle : ""],
    ["Lançamento", t.releaseDate ? new Date(t.releaseDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : ""],
    ["Gênero", t.genres.join(", ")],
    [t.type === "movie" ? "Direção" : "Criação", t.directors.join(", ")],
    [t.type === "movie" ? "Duração" : "Episódios", t.type === "movie" ? fmtRuntime(t.runtime) : [t.seasons && `${t.seasons} temporada(s)`, t.episodes && `${t.episodes} episódios`].filter(Boolean).join(", ")],
    ["Classificação", t.certification ? (/^\d+$/.test(t.certification) ? `${t.certification} anos` : t.certification) : ""],
  ]
  const watch = t.watch
  const hasWatch = !!watch && watch.stream.length + watch.free.length + watch.rent.length + watch.buy.length > 0

  return (
    <>
      <section aria-labelledby="h-ficha" className="mt-10 flex max-w-[720px] flex-col gap-5 rounded-[20px] border border-white/12 bg-white/3 p-[clamp(16px,3vw,24px)]">
        <div className="flex flex-wrap gap-5">
          <span className="aspect-2/3 w-[clamp(110px,22vw,150px)] shrink-0 rounded-xl border border-white/14" style={{ background: bg(t.poster) }} aria-hidden />
          <div className="flex min-w-[220px] flex-1 flex-col gap-2.5">
            <h2 id="h-ficha" className="m-0 text-xl font-bold">
              {t.title} {t.year && <span className="font-medium text-dp-muted">({t.year})</span>}
            </h2>
            {t.tagline && <p className="m-0 text-sm text-dp-lilac italic">{t.tagline}</p>}
            {authorRating == null && t.rating > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <Star className="size-4 text-dp-yellow" fill="currentColor" aria-hidden />
                <b>{t.rating.toLocaleString("pt-BR")}</b>
                <span className="text-xs text-dp-muted">/10 · {t.votes.toLocaleString("pt-BR")} votos na TMDB</span>
              </span>
            )}
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-[#9C8AA6]">{k}</dt>
                  <dd className="m-0">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-1 flex flex-wrap gap-2">
              {t.trailer && (
                <a href={t.trailer.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full bg-dp-orange px-4 text-xs font-semibold text-white no-underline">
                  <Play className="size-3.5" fill="currentColor" aria-hidden /> Ver trailer
                </a>
              )}
              <a href={t.tmdbUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full border border-white/30 px-4 text-xs font-semibold text-white no-underline hover:border-dp-yellow hover:text-dp-yellow">
                Ver na TMDB <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          </div>
        </div>

        {authorRating != null && t.rating > 0 && <RatingCompare author={authorRating} authorName={authorName ?? "o autor"} tmdb={t.rating} votes={t.votes} />}

        {t.cast.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-semibold tracking-widest text-[#9C8AA6] uppercase">Elenco</span>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
              {t.cast.slice(0, 8).map((c) => (
                <span key={c.name + c.character} className="flex w-[76px] shrink-0 flex-col items-center gap-1 text-center">
                  <span className="size-14 rounded-full border border-white/20" style={{ background: bg(c.photo, "#3B0A45") }} aria-hidden />
                  <span className="line-clamp-2 text-[11px] leading-tight font-semibold">{c.name}</span>
                  <span className="line-clamp-1 text-[10px] text-dp-muted">{c.character}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div id="onde-assistir" className="flex flex-col gap-3 border-t border-white/10 pt-4">
          <h3 className="m-0 text-base font-semibold">Onde assistir no Brasil</h3>
          {hasWatch ? (
            <>
              <Providers label="Streaming" list={watch!.stream} />
              <Providers label="Grátis" list={watch!.free} />
              <Providers label="Alugar" list={watch!.rent} />
              <Providers label="Comprar" list={watch!.buy} />
              {watch!.link && (
                <a href={watch!.link} target="_blank" rel="noopener noreferrer" className="text-xs text-dp-lilac">
                  Ver todas as opções e preços
                </a>
              )}
            </>
          ) : (
            <p className="m-0 text-sm text-dp-muted">Ainda não há opções de streaming, aluguel ou compra registradas para o Brasil.</p>
          )}
          <span className="text-[11px] text-[#9C8AA6]">Disponibilidade por JustWatch, via TMDB.</span>
        </div>
      </section>

      {t.recommendations.length > 0 && (
        <section aria-labelledby="h-recs" className="mt-10 flex max-w-[720px] flex-col gap-4">
          <h2 id="h-recs" className="m-0 text-xl font-bold">Se você gostou, assista também</h2>
          <div className="no-scrollbar -mx-1 flex snap-x gap-3.5 overflow-x-auto px-1 pb-2">
            {t.recommendations.map((c) => <TitleCardLink key={`${c.type}-${c.id}`} c={c} />)}
          </div>
          <span className="text-[11px] text-[#9C8AA6]">Sugestões da TMDB.</span>
        </section>
      )}
    </>
  )
}
