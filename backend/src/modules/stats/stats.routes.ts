// Números da "Visão geral" do painel, todos calculados a partir do banco.

import { Router } from "express"
import { z } from "zod"
import { authenticate } from "../../middlewares/auth"
import { POST_STATUSES } from "../../lib/constants"
import { relativeTime } from "../../lib/format"
import { mediaUrl } from "../../lib/media-url"
import { prisma } from "../../lib/prisma"
import { parse } from "../../lib/validate"
import { postType } from "../posts/posts.mapper"

const DAY = 86_400_000

/** Data "de calendário" de hoje (meia-noite UTC), igual ao que é gravado em PostViewDaily.day. */
export const todayKey = (now = new Date()) => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur ? 100 : 0)

export const statsRouter = Router()

statsRouter.get("/overview", authenticate, async (req, res) => {
  const { days } = parse(z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)).default(30) }), req.query)
  const today = todayKey()
  const from = new Date(today.getTime() - (days - 1) * DAY)
  const prevFrom = new Date(from.getTime() - days * DAY)
  const now = new Date()

  const [daily, prevViews, sources, byPost, statusRows, allViews, comments, pendingList, users, newUsers, prevUsers, imagesNoAlt, lowSeo, nextScheduled] =
    await Promise.all([
      prisma.postViewDaily.groupBy({ by: ["day"], where: { day: { gte: from } }, _sum: { views: true } }),
      prisma.postViewDaily.aggregate({ where: { day: { gte: prevFrom, lt: from } }, _sum: { views: true } }),
      prisma.postViewDaily.groupBy({ by: ["source"], where: { day: { gte: from } }, _sum: { views: true } }),
      prisma.postViewDaily.groupBy({ by: ["postId"], where: { day: { gte: from } }, _sum: { views: true }, orderBy: { _sum: { views: "desc" } }, take: 50 }),
      prisma.post.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.post.aggregate({ where: { status: { not: "trash" } }, _sum: { views: true } }),
      prisma.comment.groupBy({ by: ["status"], where: { parentId: null }, _count: { _all: true } }),
      prisma.comment.findMany({
        where: { status: "pending", parentId: null },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { post: { select: { title: true } } },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: from } } }),
      prisma.user.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
      prisma.media.count({ where: { type: "image", alt: "" } }),
      prisma.post.count({ where: { status: { not: "trash" }, seoScore: { lt: 65 } } }),
      prisma.post.findFirst({ where: { status: "scheduled" }, orderBy: { scheduledAt: "asc" }, select: { title: true, scheduledAt: true } }),
    ])

  // série diária completa (dias sem visita = 0)
  const dayKey = (d: Date) => d.toISOString().slice(0, 10)
  const perDay = new Map(daily.map((d) => [dayKey(d.day), d._sum.views ?? 0]))
  const series = Array.from({ length: days }, (_, i) => {
    const key = dayKey(new Date(from.getTime() + i * DAY))
    return { day: key, views: perDay.get(key) ?? 0 }
  })
  const viewsPeriod = series.reduce((a, d) => a + d.views, 0)

  const statusCounts: Record<string, number> = Object.fromEntries(POST_STATUSES.map((s) => [s, 0]))
  for (const r of statusRows) statusCounts[r.status] = r._count._all
  const commentCounts: Record<string, number> = { pending: 0, approved: 0, spam: 0, trash: 0 }
  for (const r of comments) commentCounts[r.status] = r._count._all

  // posts: mais vistos no período (+ publicados sem visita no período, para a tabela não ficar vazia)
  const periodViews = new Map(byPost.map((p) => [p.postId, p._sum.views ?? 0]))
  const posts = await prisma.post.findMany({
    where: { status: "published" },
    include: { category: true, author: { select: { name: true } }, cover: true },
    orderBy: { publishedAt: "desc" },
    take: 200,
  })
  const topPosts = posts
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      type: postType(p),
      author: p.author.name,
      img: p.cover ? mediaUrl(p.cover) : "",
      periodViews: periodViews.get(p.id) ?? 0,
      views: p.views,
      comments: p.commentsCount,
      seo: p.seoScore,
      publishedAt: p.publishedAt,
    }))

  // atividade recente: eventos reais do banco, mais novos primeiro
  const [recentPosts, recentComments, recentUsers] = await Promise.all([
    prisma.post.findMany({ where: { status: { in: ["published", "scheduled", "review"] } }, orderBy: { updatedAt: "desc" }, take: 6, include: { author: { select: { name: true, color: true } } } }),
    prisma.comment.findMany({ where: { parentId: null, status: { in: ["pending", "approved"] } }, orderBy: { createdAt: "desc" }, take: 6, include: { post: { select: { title: true } } } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 4, select: { name: true, color: true, createdAt: true } }),
  ])
  const verb: Record<string, string> = { published: "publicou", scheduled: "agendou", review: "enviou para revisão" }
  const activity = [
    ...recentPosts.map((p) => ({ who: p.author.name, color: p.author.color, what: `${verb[p.status]} "${p.title}"`, at: p.updatedAt })),
    ...recentComments.map((c) => ({ who: c.authorName, color: "#3B0A45", what: `comentou em "${c.post.title}"`, at: c.createdAt })),
    ...recentUsers.map((u) => ({ who: u.name, color: u.color, what: "criou uma conta", at: u.createdAt })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6)
    .map((a) => ({ ...a, when: relativeTime(a.at, now) }))

  // alertas a partir do estado atual
  const alerts: { level: "good" | "warning" | "error"; title: string; description: string; href?: string }[] = []
  if (commentCounts.pending) alerts.push({ level: "warning", title: `${commentCounts.pending} comentário(s) aguardando moderação`, description: "Aprove, responda ou marque como spam.", href: "/painel/comentarios" })
  if (lowSeo) alerts.push({ level: "error", title: `${lowSeo} post(s) com SEO abaixo de 65`, description: "Veja o que corrigir no painel de SEO.", href: "/painel/seo" })
  if (imagesNoAlt) alerts.push({ level: "warning", title: `${imagesNoAlt} imagem(ns) sem texto alternativo`, description: "Isso afeta acessibilidade e SEO.", href: "/painel/midia" })
  if (statusCounts.review) alerts.push({ level: "warning", title: `${statusCounts.review} post(s) em revisão`, description: "Aguardando alguém revisar e publicar.", href: "/painel/posts" })
  if (nextScheduled?.scheduledAt) alerts.push({ level: "good", title: "Próxima publicação agendada", description: `"${nextScheduled.title}" em ${nextScheduled.scheduledAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`, href: "/painel/agendamento" })
  if (!alerts.length) alerts.push({ level: "good", title: "Tudo em ordem", description: "Nenhuma pendência no momento." })

  const prev = prevViews._sum.views ?? 0
  res.json({
    days,
    views: { period: viewsPeriod, previous: prev, change: pct(viewsPeriod, prev), allTime: allViews._sum.views ?? 0, series },
    sources: sources.map((s) => ({ source: s.source, views: s._sum.views ?? 0 })).sort((a, b) => b.views - a.views),
    posts: { total: POST_STATUSES.filter((s) => s !== "trash").reduce((a, s) => a + statusCounts[s], 0), byStatus: statusCounts },
    comments: { ...commentCounts, pendingList: pendingList.map((c) => ({ id: c.id, name: c.authorName, post: c.post.title, content: c.content, time: relativeTime(c.createdAt, now) })) },
    users: { total: users, newInPeriod: newUsers, change: pct(newUsers, prevUsers) },
    topPosts,
    activity,
    alerts,
  })
})
