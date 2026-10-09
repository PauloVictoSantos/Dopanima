import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { AuthorAvatar, SaveButton } from "@/components/brand"
import { RelatedCard } from "@/components/cards"
import { BackButton, Reveal, ReadingProgress, ShareBar, ViewTracker } from "@/components/post/post-client"
import { PostComments } from "@/components/post/post-comments"
import { TmdbInfo, fmtRating } from "@/components/post/tmdb-info"
import { TYPE_META, coverBg } from "@/lib/posts"
import { getPostPage, getPostTmdb, resolveRedirect } from "@/lib/public-api"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: PageProps<"/post/[slug]">): Promise<Metadata> {
  const data = await getPostPage((await params).slug)
  if (!data) return {}
  const { post } = data
  const seo = post.seo
  return {
    // O backend já aplica o modelo de título do site ("%titulo% | Dopanima").
    title: { absolute: seo.title },
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical: seo.canonical },
    robots: { index: seo.index, follow: seo.follow },
    authors: [{ name: post.author.name }],
    openGraph: {
      type: "article",
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
      siteName: "Dopanima",
      locale: "pt_BR",
      images: seo.image ? [{ url: seo.image, alt: seo.imageAlt || post.title }] : undefined,
      publishedTime: seo.publishedTime ?? undefined,
      modifiedTime: seo.modifiedTime,
      section: seo.section,
      tags: post.tags.map((t) => t.name),
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, images: seo.image ? [seo.image] : undefined },
  }
}

export default async function PostPage({ params }: PageProps<"/post/[slug]">) {
  const { slug } = await params
  const data = await getPostPage(slug)
  if (!data) {
    // Slug antigo de um post renomeado, ou redirecionamento cadastrado no painel.
    const to = await resolveRedirect(`/post/${slug}`)
    if (to) permanentRedirect(to)
    notFound()
  }

  const { post, related } = data
  // Ficha da TMDB (se o post tiver filme/série vinculado). Falhas da TMDB não derrubam a página.
  const tmdb = post.tmdb ? await getPostTmdb(post.slug) : null
  const meta = TYPE_META[post.type]
  // Nota do autor vira uma avaliação (Review) para o Google, além do artigo.
  const reviewType = post.type === "filme" ? "Movie" : post.type === "serie" ? "TVSeries" : post.type === "livro" ? "Book" : null
  const review =
    post.authorRating != null && reviewType
      ? {
          "@context": "https://schema.org",
          "@type": "Review",
          name: post.title,
          author: { "@type": "Person", name: post.author.name },
          datePublished: post.seo.publishedTime,
          reviewRating: { "@type": "Rating", ratingValue: post.authorRating, bestRating: 10, worstRating: 0 },
          itemReviewed: {
            "@type": reviewType,
            name: post.type === "livro" ? post.book || post.title : tmdb?.title || post.title,
            ...(post.type === "livro" && post.bookAuthor ? { author: { "@type": "Person", name: post.bookAuthor } } : {}),
            ...(tmdb?.releaseDate ? { dateCreated: tmdb.releaseDate } : {}),
            ...(tmdb?.directors.length && post.type === "filme" ? { director: tmdb.directors.map((name) => ({ "@type": "Person", name })) } : {}),
            ...(tmdb?.posterLarge ? { image: tmdb.posterLarge } : {}),
          },
          publisher: { "@type": "Organization", name: "Dopanima" },
        }
      : null
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": post.type === "noticia" ? "NewsArticle" : "Article",
    headline: post.title,
    description: post.seo.description,
    image: post.seo.image ? [post.seo.image] : undefined,
    datePublished: post.seo.publishedTime,
    dateModified: post.seo.modifiedTime,
    author: { "@type": "Person", name: post.author.name },
    publisher: { "@type": "Organization", name: "Dopanima" },
    mainEntityOfPage: post.seo.canonical,
    keywords: post.seo.keywords.join(", "),
  }

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {review && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(review).replace(/</g, "\\u003c") }} />}
      <ViewTracker slug={post.slug} />
      <ReadingProgress />
      <div aria-hidden className="relative h-[min(56vh,520px)] min-h-80" style={{ background: coverBg(post) }}>
        <div className="absolute inset-0 bg-linear-to-t from-dp-bg to-transparent to-45%" />
      </div>

      <article className="relative mx-auto -mt-[140px] max-w-[880px] px-[clamp(16px,5vw,64px)]">
        <Reveal>
          <BackButton />
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex h-7 items-center rounded-full px-3.5 text-xs font-semibold tracking-[0.06em] text-dp-bg uppercase"
              style={{ background: meta.color }}
            >
              {meta.label}
            </span>
            {post.sub && <span className="inline-flex h-7 items-center rounded-full border border-white/40 px-3.5 text-xs font-semibold">{post.sub}</span>}
            {post.authorRating != null && (
              <a href="#h-ficha" className="inline-flex h-7 items-center gap-1.5 rounded-full bg-dp-yellow px-3.5 text-xs font-bold text-dp-bg no-underline" title={`Nota de ${post.author.name}`}>
                ★ {fmtRating(post.authorRating)}<span className="font-semibold opacity-70">/10 · nota do autor</span>
              </a>
            )}
          </div>
          <h1 className="mt-4 mb-2.5 font-display text-[clamp(40px,6vw,68px)] leading-none font-normal text-balance">{post.title}</h1>
          {post.subtitle && <p className="mb-5 text-lg font-medium text-dp-lilac">{post.subtitle}</p>}
          <div className="flex flex-wrap items-center gap-3 border-b border-white/12 pb-5 text-[13px] text-dp-muted">
            <AuthorAvatar author={post.author} size={36} />
            <span className="font-semibold text-white">{post.author.name}</span>
            <span aria-hidden>·</span>
            <span className="font-semibold text-dp-green">{post.dateLabel}</span>
            <span aria-hidden>·</span>
            <span>{post.readTime} de leitura</span>
            <SaveButton slug={post.slug} small className="ml-auto bg-transparent" />
          </div>
        </Reveal>

        <Reveal>
          {/* HTML já sanitizado pelo backend ao salvar o post. */}
          <div className="rich-text mt-8 max-w-[720px] text-lg! leading-[1.7] text-pretty" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </Reveal>

        {post.tags.length > 0 && (
          <div className="mt-6 flex max-w-[720px] flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t.slug} className="inline-flex h-7 items-center rounded-full bg-dp-lilac/16 px-3 text-xs font-semibold text-dp-lilac">#{t.name}</span>
            ))}
          </div>
        )}

        {tmdb && <TmdbInfo t={tmdb} authorRating={post.authorRating} authorName={post.author.name} />}

        <ShareBar title={post.title} />
        <PostComments slug={post.slug} />
      </article>

      {related.length > 0 && (
        <section aria-labelledby="h-rel" className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,64px)] pt-14 pb-[72px]">
          <h2 id="h-rel" className="mb-5 text-2xl font-bold">Posts relacionados</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {related.map((p, i) => (
              <Reveal key={p.slug} delay={i * 0.08}>
                <RelatedCard post={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
