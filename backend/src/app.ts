import path from "node:path"
import cors from "cors"
import express from "express"
import rateLimit from "express-rate-limit"
import helmet from "helmet"
import morgan from "morgan"
import { env } from "./config/env"
import { prisma } from "./lib/prisma"
import { errorHandler, notFoundHandler } from "./middlewares/error-handler"
import { UPLOAD_PATH } from "./middlewares/upload"
import { authRouter } from "./modules/auth/auth.routes"
import { categoriesRouter } from "./modules/categories/categories.routes"
import { commentsRouter } from "./modules/comments/comments.routes"
import { mediaRouter } from "./modules/media/media.routes"
import { postsRouter } from "./modules/posts/posts.routes"
import { publicRouter, seoFilesRouter } from "./modules/public/public.routes"
import { seoRouter } from "./modules/seo/seo.routes"
import { siteRouter } from "./modules/site/site.routes"
import { statsRouter } from "./modules/stats/stats.routes"
import { tagsRouter } from "./modules/tags/tags.routes"
import { publicTmdbRouter, tmdbRouter } from "./modules/tmdb/tmdb.routes"
import { usersRouter } from "./modules/users/users.routes"

export function createApp() {
  const app = express()

  app.disable("x-powered-by")
  // Só confia em X-Forwarded-For quando há proxy de verdade na frente (TRUST_PROXY=1).
  app.set("trust proxy", env.TRUST_PROXY)
  // Arquivos de /uploads são exibidos pelo frontend, que roda em outra origem.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }))
  // credentials: o painel usa cookie de sessão; só as origens do FRONTEND_URL podem mandá-lo.
  app.use(cors({ origin: env.ALLOWED_ORIGINS, credentials: true, maxAge: 600 }))
  app.use(express.json({ limit: "2mb" }))
  if (env.NODE_ENV !== "test") app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"))

  // Teto geral por IP, contra abuso e varredura. Rotas sensíveis têm limites próprios.
  app.use("/api", rateLimit({ windowMs: 15 * 60_000, limit: 1500, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Muitas requisições. Tente de novo em instantes." } }))

  // Uploads: sem execução de nada no navegador, e documentos sempre baixados.
  app.use(
    "/uploads",
    express.static(UPLOAD_PATH, {
      maxAge: "7d",
      index: false,
      dotfiles: "deny",
      setHeaders: (res, file) => {
        res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox")
        res.setHeader("X-Content-Type-Options", "nosniff")
        if (path.extname(file).toLowerCase() === ".pdf") res.setHeader("Content-Disposition", "attachment")
      },
    })
  )

  // Verifica a API e a conexão com o banco (SELECT 1).
  app.get("/api/health", async (_req, res) => {
    const started = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ ok: true, database: "conectado", latencyMs: Date.now() - started })
    } catch (err) {
      // Detalhe do erro só em desenvolvimento.
      res.status(503).json({ ok: false, database: "desconectado", ...(env.NODE_ENV !== "production" ? { error: err instanceof Error ? err.message.split("\n").filter(Boolean).pop() : String(err) } : {}) })
    }
  })

  // Painel (autenticado)
  app.use("/api/auth", authRouter)
  app.use("/api/posts", postsRouter)
  app.use("/api/categories", categoriesRouter)
  app.use("/api/tags", tagsRouter)
  app.use("/api/media", mediaRouter)
  app.use("/api/users", usersRouter)
  app.use("/api/comments", commentsRouter)
  app.use("/api/stats", statsRouter)
  app.use("/api/seo", seoRouter)
  app.use("/api/tmdb", tmdbRouter)

  // Site público
  app.use("/api/public", siteRouter)
  app.use("/api/public", publicTmdbRouter)
  app.use("/api/public", publicRouter)
  app.use("/", seoFilesRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
