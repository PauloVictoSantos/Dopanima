import Link from "next/link"
import { ExternalLink, Star } from "lucide-react"
import { fmtRating } from "@/components/post/tmdb-info"
import type { BookCard, BookDetails } from "@/lib/dashboard-api"

export type PostBook = BookDetails

const bg = (url: string, fallback = "#2A0A36") => (url ? `url("${url}") center/cover no-repeat, ${fallback}` : fallback)

const LANGS: Record<string, string> = { pt: "Português", "pt-BR": "Português", en: "Inglês", es: "Espanhol", fr: "Francês", de: "Alemão", it: "Italiano", ja: "Japonês" }

/** O Google manda a data como "2019", "2019-05" ou "2019-05-14". */
function fmtPublished(d: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
  if (/^\d{4}-\d{2}$/.test(d)) return new Date(d + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  return d
}

/** Card de livro: leva para a resenha do blog quando existe, senão para o Google Books. */
export function BookCardLink({ c }: { c: BookCard }) {
  const body = (
    <>
      <span className="relative block aspect-2/3 overflow-hidden rounded-xl border border-white/12" style={{ background: bg(c.cover) }}>
        {c.postSlug && (
          <span className="absolute right-2 bottom-2 rounded-full bg-dp-yellow px-2 py-0.5 text-[11px] font-bold text-dp-bg">
            Resenha{c.postRating != null ? ` · ${fmtRating(c.postRating)}` : ""}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-[13px] leading-[1.35] font-semibold">{c.title}</span>
      <span className="line-clamp-1 text-xs text-dp-muted">{[c.authors[0], c.year].filter(Boolean).join(" · ")}</span>
    </>
  )
  const cls = "flex w-[150px] shrink-0 snap-start flex-col gap-2 text-white no-underline transition-transform duration-300 hover:-translate-y-1"
  return c.postSlug ? (
    <Link href={`/post/${c.postSlug}`} className={cls}>{body}</Link>
  ) : (
    <a href={c.url} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
  )
}

/** Ficha do livro ligado ao post e mais obras do mesmo autor. */
export function BookInfo({ b }: { b: PostBook }) {
  const facts: [string, string][] = [
    ["Autor", b.authors.join(", ")],
    ["Editora", b.publisher],
    ["Publicação", b.publishedDate ? fmtPublished(b.publishedDate) : ""],
    ["Páginas", b.pageCount ? String(b.pageCount) : ""],
    ["Gênero", b.categories.join(", ")],
    ["Idioma", LANGS[b.language] ?? b.language.toUpperCase()],
    ["ISBN", b.isbn13 || b.isbn10],
  ]
  const synopsis = b.description.split("\n\n").slice(0, 3)

  return (
    <>
      <section aria-labelledby="h-livro" className="mt-10 flex max-w-[720px] flex-col gap-5 rounded-[20px] border border-white/12 bg-white/3 p-[clamp(16px,3vw,24px)]">
        <div className="flex flex-wrap gap-5">
          <span className="aspect-2/3 w-[clamp(110px,22vw,150px)] shrink-0 rounded-xl border border-white/14" style={{ background: bg(b.coverLarge || b.cover) }} aria-hidden />
          <div className="flex min-w-[220px] flex-1 flex-col gap-2.5">
            <h2 id="h-livro" className="m-0 text-xl font-bold">
              {b.title} {b.year && <span className="font-medium text-dp-muted">({b.year})</span>}
            </h2>
            {b.subtitle && <p className="m-0 text-sm text-dp-lilac italic">{b.subtitle}</p>}
            {b.rating > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <Star className="size-4 text-dp-yellow" fill="currentColor" aria-hidden />
                <b>{(b.rating / 2).toLocaleString("pt-BR")}</b>
                <span className="text-xs text-dp-muted">/5 · {b.votes.toLocaleString("pt-BR")} avaliações no Google Books</span>
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
              <a href={b.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full border border-white/30 px-4 text-xs font-semibold text-white no-underline hover:border-dp-yellow hover:text-dp-yellow">
                Ver no Google Books <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </div>
          </div>
        </div>

        {synopsis.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
            <h3 className="m-0 text-base font-semibold">Sinopse</h3>
            {synopsis.map((p, i) => <p key={i} className="m-0 text-sm leading-relaxed text-dp-body">{p}</p>)}
          </div>
        )}
        <span className="text-[11px] text-[#9C8AA6]">Dados e capa: Google Books.</span>
      </section>

      {b.moreByAuthor.length > 0 && (
        <section aria-labelledby="h-mais-autor" className="mt-10 flex max-w-[720px] flex-col gap-4">
          <h2 id="h-mais-autor" className="m-0 text-xl font-bold">Mais livros de {b.authors[0]}</h2>
          <div className="no-scrollbar -mx-1 flex snap-x gap-3.5 overflow-x-auto px-1 pb-2">
            {b.moreByAuthor.map((c) => <BookCardLink key={c.id} c={c} />)}
          </div>
        </section>
      )}
    </>
  )
}
