import { Router } from "express"
import { z } from "zod"
import { authenticate, requirePermission } from "../../middlewares/auth"
import { notFound } from "../../lib/http-error"
import { idParam, parse } from "../../lib/validate"
import * as seo from "./seo.service"
import { getSettings, settingsSchema, updateSettings } from "./settings.service"

const analyzeSchema = z.object({
  postId: z.number().int().positive().optional(),
  title: z.string().default(""),
  slug: z.string().default(""),
  excerpt: z.string().default(""),
  content: z.string().max(500_000).default(""),
  focusKeyword: z.string().default(""),
  metaTitle: z.string().default(""),
  metaDescription: z.string().default(""),
  canonicalUrl: z.string().default(""),
  index: z.boolean().default(true),
  coverId: z.number().int().positive().nullable().default(null),
})

export const seoRouter = Router()

seoRouter.use(authenticate)

/** Análise ao vivo do editor: nada é salvo. */
seoRouter.post("/analyze", requirePermission("create", "editOwn", "editAll"), async (req, res) => {
  const { postId, ...input } = parse(analyzeSchema, req.body)
  res.json(await seo.analyzeDraft({ ...input, coverAlt: null }, postId))
})

/** Relatório atualizado de um post já salvo. */
seoRouter.get("/posts/:id", requirePermission("create", "editOwn", "editAll", "seo"), async (req, res) => {
  const report = await seo.refreshPostSeo(idParam(req.params.id))
  if (!report) throw notFound("Post não encontrado")
  res.json(report)
})

seoRouter.get("/overview", requirePermission("seo", "analytics"), async (_req, res) => {
  res.json(await seo.overview())
})

seoRouter.post("/recalculate", requirePermission("seo"), async (_req, res) => {
  res.json(await seo.recalculateAll())
})

seoRouter.get("/settings", requirePermission("seo"), async (_req, res) => {
  res.json(await getSettings())
})

seoRouter.put("/settings", requirePermission("seo"), async (req, res) => {
  const before = await getSettings()
  const after = await updateSettings(parse(settingsSchema.partial(), req.body))
  // Modelo de título e URL do site mudam a nota de todos os posts.
  if (before.titleTemplate !== after.titleTemplate || before.siteUrl !== after.siteUrl) await seo.recalculateAll()
  res.json(after)
})

seoRouter.get("/robots", requirePermission("seo"), async (_req, res) => {
  res.json({ content: await seo.robotsTxt() })
})

seoRouter.put("/robots", requirePermission("seo"), async (req, res) => {
  const { content } = parse(z.object({ content: z.string().max(5000) }), req.body)
  await updateSettings({ robots: content })
  res.json({ content })
})

seoRouter.get("/redirects", requirePermission("seo"), async (_req, res) => {
  res.json(await seo.listRedirects())
})

seoRouter.post("/redirects", requirePermission("seo"), async (req, res) => {
  const { from, to } = parse(z.object({ from: z.string().trim().min(1, "Preencha a origem"), to: z.string().trim().min(1, "Preencha o destino") }), req.body)
  res.status(201).json(await seo.createRedirect(from, to))
})

seoRouter.delete("/redirects/:id", requirePermission("seo"), async (req, res) => {
  await seo.deleteRedirect(idParam(req.params.id))
  res.status(204).end()
})
