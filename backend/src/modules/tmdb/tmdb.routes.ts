import { Router } from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import { env } from "../../config/env"
import { prisma } from "../../lib/prisma"
import { tmdbConfigured } from "../../lib/tmdb"
import { idParam, parse } from "../../lib/validate"
import { authenticate, requirePermission } from "../../middlewares/auth"
import * as tmdb from "./tmdb.service"

const typeSchema = z.enum(["movie", "tv"])
const listSchema = z.enum(Object.keys(tmdb.LISTS) as [tmdb.ListKey, ...tmdb.ListKey[]])

// ---------- painel ----------

export const tmdbRouter = Router()

tmdbRouter.use(authenticate, requirePermission("create", "editOwn", "editAll"))

tmdbRouter.get("/status", (_req, res) => {
  res.json({ enabled: tmdbConfigured(), language: env.TMDB_LANGUAGE, region: env.TMDB_REGION })
})

tmdbRouter.get("/search", async (req, res) => {
  const q = parse(
    z.object({ q: z.string().trim().min(1, "Digite o nome do filme ou série").max(100), type: z.enum(["all", "movie", "tv"]).default("all"), page: z.coerce.number().int().min(1).max(20).default(1) }),
    req.query
  )
  res.json(await tmdb.search(q.q, q.type, q.page))
})

tmdbRouter.get("/:type/:id", async (req, res) => {
  res.json(await tmdb.details(parse(typeSchema, req.params.type), idParam(req.params.id)))
})

/** Importa pôster ou cena para a biblioteca de mídia (vira imagem destacada). */
tmdbRouter.post("/:type/:id/import", requirePermission("media"), async (req, res) => {
  const body = parse(z.object({ path: z.string().max(100), kind: z.enum(["poster", "backdrop"]).default("poster") }), req.body)
  res.status(201).json(await tmdb.importImage(req.user!.id, parse(typeSchema, req.params.type), idParam(req.params.id), body.path, body.kind))
})

// ---------- site público ----------

export const publicTmdbRouter = Router()

// A TMDB tem limite de uso; o cache já evita quase tudo, isto barra abuso.
publicTmdbRouter.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Muitas requisições" } }))

/** "O que assistir": listas da TMDB. Sem chave configurada, responde vazio (a home não quebra). */
publicTmdbRouter.get("/tmdb/suggestions", async (req, res) => {
  const q = parse(z.object({ type: typeSchema.default("movie"), list: listSchema.default("trending") }), req.query)
  if (!tmdbConfigured()) {
    res.json({ enabled: false, items: [] })
    return
  }
  res.json({ enabled: true, title: tmdb.LISTS[q.list], items: await tmdb.suggestions(q.type, q.list) })
})

/** Ficha técnica, onde assistir e recomendações do título ligado ao post. */
publicTmdbRouter.get("/posts/:slug/tmdb", async (req, res) => {
  const post = await prisma.post.findFirst({
    where: { slug: String(req.params.slug).slice(0, 191), status: "published", publishedAt: { lte: new Date() } },
    select: { id: true, tmdbId: true, tmdbType: true },
  })
  if (!post?.tmdbId || (post.tmdbType !== "movie" && post.tmdbType !== "tv") || !tmdbConfigured()) {
    res.json({ enabled: false })
    return
  }
  const { images: _images, ...d } = await tmdb.details(post.tmdbType, post.tmdbId)
  // O próprio post não aparece nas recomendações dele.
  res.json({ enabled: true, ...d, recommendations: d.recommendations.filter((r) => r.id !== post.tmdbId) })
})
