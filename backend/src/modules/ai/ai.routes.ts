import { Router } from "express"
import rateLimit from "express-rate-limit"
import { env } from "../../config/env"
import { geminiConfigured } from "../../lib/gemini"
import { parse } from "../../lib/validate"
import { authenticate, requirePermission } from "../../middlewares/auth"
import * as ai from "./ai.service"

// Assistente de escrita do editor (Gemini). Só para quem escreve posts; cada pedido conta no limite diário.
export const aiRouter = Router()

aiRouter.use(authenticate, requirePermission("create", "editOwn", "editAll"))

// Além do limite diário, segura rajadas (cliques repetidos, scripts).
const burst = rateLimit({
  windowMs: 60_000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => `ai:${req.user!.id}`,
  message: { error: "Muitos pedidos ao assistente em sequência. Aguarde um minuto." },
})

aiRouter.get("/status", async (req, res) => {
  res.json({ enabled: geminiConfigured(), model: env.GEMINI_MODEL, ...(await ai.usage(req.user!.id)) })
})

aiRouter.post("/draft", burst, async (req, res) => {
  res.json(await ai.draft(req.user!.id, parse(ai.schemas.draft, req.body)))
})

aiRouter.post("/continue", burst, async (req, res) => {
  res.json(await ai.continueText(req.user!.id, parse(ai.schemas.continue, req.body)))
})

aiRouter.post("/edit", burst, async (req, res) => {
  res.json(await ai.editText(req.user!.id, parse(ai.schemas.edit, req.body)))
})

aiRouter.post("/fill", burst, async (req, res) => {
  res.json(await ai.fill(req.user!.id, parse(ai.schemas.fill, req.body)))
})

aiRouter.post("/references", burst, async (req, res) => {
  res.json(await ai.references(req.user!.id, parse(ai.schemas.references, req.body)))
})

aiRouter.post("/news", burst, async (req, res) => {
  res.json(await ai.news(req.user!.id, parse(ai.schemas.news, req.body)))
})
