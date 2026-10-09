"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Archive, Calendar, Copy, Eye, Pause, PenLine, Send, Trash2, Undo2, XCircle } from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { RowActions, type RowAction } from "@/components/dashboard/row-actions"
import { CatChip, PageHeading, PageMain, PillTabs, SeoBadge, StatusPill, Thumb, btnPrimary, inputCls, selectCls } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { KIND_CATEGORY_SLUG, STATUS_CODE, postsApi, toDashPost } from "@/lib/dashboard-api"
import { POST_KINDS, TYPE2CAT, fmtDate, nf, type DashPost, type PostKind, type PostStatus } from "@/lib/dashboard"

const STATUS_TABS: { key: PostStatus | "Todos"; label: string }[] = [
  { key: "Todos", label: "Todos" },
  { key: "Publicado", label: "Publicados" },
  { key: "Rascunho", label: "Rascunhos" },
  { key: "Em revisão", label: "Em revisão" },
  { key: "Agendado", label: "Agendados" },
  { key: "Arquivado", label: "Arquivados" },
  { key: "Lixeira", label: "Lixeira" },
]

type Sort = "recent" | "views" | "seo"

export function PostsView() {
  const router = useRouter()
  const { cats, authors, can, reloadPosts, postsQuery, setPostsQuery, postsStatus, setPostsStatus } = useDashboard()
  const [cat, setCat] = useState<PostKind | "Todas">("Todas")
  const [authorId, setAuthorId] = useState(0)
  const [sort, setSort] = useState<Sort>("recent")
  const [rows, setRows] = useState<DashPost[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const categoryId = cat === "Todas" ? undefined : cats.find((c) => c.parent === 0 && c.slug === KIND_CATEGORY_SLUG[cat])?.id

  // Busca, filtros, ordenação e contagens por status vêm do backend.
  const load = useCallback(async () => {
    try {
      const res = await postsApi.list({
        status: postsStatus === "Todos" ? "all" : STATUS_CODE[postsStatus],
        q: postsQuery.trim(),
        categoryId,
        authorId: authorId || undefined,
        sort,
      })
      setRows(res.items.map(toDashPost))
      setCounts(res.counts)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [postsStatus, postsQuery, categoryId, authorId, sort])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const run = async (task: () => Promise<unknown>, msg: string) => {
    try {
      await task()
      toast.success(msg)
      await Promise.all([load(), reloadPosts()])
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  // "Excluir definitivamente" apaga do banco (com confirmação); a lixeira guarda por 30 dias.
  const purge = (p: DashPost) => {
    if (!window.confirm(`Excluir "${p.title}" definitivamente? Isso apaga o post, os comentários e as estatísticas dele e não pode ser desfeito.`)) return
    void run(() => postsApi.remove(p.id), "Post excluído definitivamente")
  }

  const emptyTrash = () => {
    const n = countFor("Lixeira")
    if (!n || !window.confirm(`Excluir definitivamente os ${n} post(s) da lixeira? Isso não pode ser desfeito.`)) return
    void run(() => postsApi.emptyTrash(), `Lixeira esvaziada: ${n} post(s) excluído(s)`)
  }

  const actionsFor = (p: DashPost): RowAction[][] => {
    const remove: RowAction[] = can("delete") ? [{ label: "Excluir definitivamente", icon: XCircle, destructive: true, onClick: () => purge(p) }] : []
    if (p.status === "Lixeira")
      return [[{ label: "Restaurar como rascunho", icon: Undo2, onClick: () => run(() => postsApi.setStatus(p.id, "Rascunho"), "Post restaurado como rascunho") }], remove]
    return [
      [
        { label: "Editar", icon: PenLine, onClick: () => router.push(`/painel/posts/${p.id}`) },
        { label: p.status === "Publicado" ? "Ver no site" : "Visualizar", icon: Eye, onClick: () => window.open(p.status === "Publicado" ? `/post/${p.slug}` : `/painel/posts/${p.id}`, "_blank") },
        { label: "Duplicar", icon: Copy, onClick: () => run(() => postsApi.duplicate(p.id), "Post duplicado como rascunho") },
      ],
      [
        p.status === "Publicado"
          ? { label: "Despublicar", icon: Pause, onClick: () => run(() => postsApi.setStatus(p.id, "Rascunho"), "Post despublicado") }
          : { label: "Publicar agora", icon: Send, disabled: !can("publish"), onClick: () => run(() => postsApi.setStatus(p.id, "Publicado"), "Post publicado") },
        { label: "Agendar", icon: Calendar, onClick: () => router.push(`/painel/posts/${p.id}`) },
        { label: "Arquivar", icon: Archive, onClick: () => run(() => postsApi.setStatus(p.id, "Arquivado"), "Post arquivado") },
      ],
      [{ label: "Mover para a lixeira", icon: Trash2, destructive: true, onClick: () => run(() => postsApi.setStatus(p.id, "Lixeira"), "Movido para a lixeira (fica 30 dias antes de ser apagado)") }, ...remove],
    ]
  }

  const countFor = (k: PostStatus | "Todos") => counts[k === "Todos" ? "all" : STATUS_CODE[k]] ?? 0

  return (
    <PageMain>
      <PageHeading eyebrow={`${counts.all ?? 0} posts · ${rows.length} exibidos`} title="Posts">
        <Link href="/painel/posts/novo" className={btnPrimary + " no-underline"}>+ Novo post</Link>
      </PageHeading>

      <PillTabs label="Status" active={postsStatus} onSelect={setPostsStatus} items={STATUS_TABS.map((t) => ({ ...t, count: countFor(t.key) }))} />

      {postsStatus === "Lixeira" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#FF8A73]/30 bg-[#FF8A73]/8 px-4 py-3 text-[13px]">
          <span className="mr-auto text-dp-body">Posts na lixeira continuam no banco e são apagados de vez automaticamente após 30 dias.</span>
          {can("delete") && countFor("Lixeira") > 0 && (
            <button onClick={emptyTrash} className="h-8 cursor-pointer rounded-full border border-[#FF8A73]/60 px-4 text-xs font-semibold text-[#FF8A73] hover:bg-[#FF8A73]/12">
              Esvaziar lixeira
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2.5">
        <input
          value={postsQuery}
          onChange={(e) => setPostsQuery(e.target.value)}
          placeholder="Buscar por título, conteúdo, autor, categoria ou tag"
          aria-label="Buscar posts"
          className={inputCls + " flex-[1_1_280px]"}
        />
        <select value={cat} onChange={(e) => setCat(e.target.value as PostKind | "Todas")} aria-label="Categoria" className={selectCls + " flex-[0_1_170px]"}>
          <option value="Todas">Todas as categorias</option>
          {POST_KINDS.map((k) => <option key={k} value={k}>{TYPE2CAT[k]}</option>)}
        </select>
        <select value={authorId} onChange={(e) => setAuthorId(Number(e.target.value))} aria-label="Autor" className={selectCls + " flex-[0_1_170px]"}>
          <option value={0}>Todos os autores</option>
          {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar" className={selectCls + " flex-[0_1_190px]"}>
          <option value="recent">Mais recentes</option>
          <option value="views">Mais visualizados</option>
          <option value="seo">Melhor SEO</option>
        </select>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-white/10 bg-white/4 px-3 py-2 [scrollbar-color:rgba(255,255,255,.2)_transparent]">
        <table className="w-full min-w-245 border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-xs text-[#9C8AA6] [&>th]:px-2.5 [&>th]:py-3 [&>th]:font-medium">
              <th>Post</th><th>Autor</th><th>Categoria</th><th>Status</th><th>Datas</th>
              <th className="text-right">Views</th><th className="text-right">Coment.</th><th className="text-right">SEO</th><th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-white/3 [&>td]:border-t [&>td]:border-white/6 [&>td]:p-2.5">
                <td>
                  <div className="flex items-center gap-3">
                    <Thumb url={p.img} className="border-0" />
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <Link href={`/painel/posts/${p.id}`} className="font-semibold text-white no-underline hover:text-dp-yellow">{p.title}</Link>
                      <span className="text-xs text-dp-lilac">{p.tags.map((t) => "#" + t).join(" ")}</span>
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap text-dp-muted">{p.author}</td>
                <td><CatChip kind={p.cat} /></td>
                <td><StatusPill status={p.status} /></td>
                <td className="text-xs leading-normal whitespace-nowrap text-dp-muted">
                  {p.status === "Agendado" && p.sched ? `Agenda: ${fmtDate(p.sched.date)}, ${p.sched.time}` : `Publicado: ${p.date ? fmtDate(p.date) : "—"}`}
                  <br />
                  Criado {fmtDate(p.created)} · Atualizado {fmtDate(p.updated)}
                </td>
                <td className="text-right font-semibold tabular-nums">{nf(p.views)}</td>
                <td className="text-right tabular-nums">{p.comments}</td>
                <td className="text-right"><SeoBadge score={p.seo} /></td>
                <td>
                  <div className="flex justify-end gap-1">
                    <RowActions label={p.title} groups={actionsFor(p)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="m-0 px-2.5 py-5 text-[13px] text-dp-muted">{loading ? "Carregando posts..." : "Nenhum post com esses filtros."}</p>}
      </section>
    </PageMain>
  )
}
