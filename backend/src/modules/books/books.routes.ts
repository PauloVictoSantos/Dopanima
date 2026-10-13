import { Router } from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import { env } from "../../config/env"
import { badRequest } from "../../lib/http-error"
import { isVolumeId } from "../../lib/google-books"
import { prisma } from "../../lib/prisma"
import { parse } from "../../lib/validate"
import { authenticate, requirePermission } from "../../middlewares/auth"
import * as books from "./books.service"

const volumeId = (v: unknown) => {
  const id = String(v)
  if (!isVolumeId(id)) throw badRequest("ID de livro inválido")
  return id
}

// ---------- painel ----------

export const booksRouter = Router()

booksRouter.use(authenticate, requirePermission("create", "editOwn", "editAll"))

booksRouter.get("/status", (_req, res) => {
  // Funciona sem chave (cota menor); `keyed` avisa o painel.
  res.json({ enabled: true, keyed: !!env.GOOGLE_BOOKS_API_KEY, language: env.GOOGLE_BOOKS_LANGUAGE })
})

booksRouter.get("/search", async (req, res) => {
  const q = parse(
    z.object({
      q: z.string().trim().min(1, "Digite o título, autor ou ISBN").max(150),
      field: z.enum(["all", "title", "author", "isbn"]).default("all"),
      page: z.coerce.number().int().min(1).max(10).default(1),
    }),
    req.query
  )
  res.json(await books.search(q.q, q.field, q.page))
})

booksRouter.get("/:id", async (req, res) => {
  res.json(await books.details(volumeId(req.params.id)))
})

/** Importa a capa para a biblioteca de mídia (vira imagem destacada). */
booksRouter.post("/:id/import", requirePermission("media"), async (req, res) => {
  res.status(201).json(await books.importCover(req.user!.id, volumeId(req.params.id)))
})

// ---------- site público ----------

export const publicBooksRouter = Router()

// O Google Books tem cota diária; o cache já evita quase tudo, isto barra abuso.
const limiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Muitas requisições" } })

/** "O que ler": livros por gênero. Se o Google falhar (cota, sem chave), responde vazio e a home não quebra. */
publicBooksRouter.get("/books/suggestions", limiter, async (req, res) => {
  const q = parse(z.object({ list: z.enum(Object.keys(books.LISTS) as [books.ListKey, ...books.ListKey[]]).default("fantasy") }), req.query)
  try {
    res.json({ enabled: true, title: books.LISTS[q.list].title, items: await books.suggestions(q.list) })
  } catch {
    res.json({ enabled: false, items: [] })
  }
})

/** Ficha do livro ligado ao post e mais livros do mesmo autor. */
publicBooksRouter.get("/posts/:slug/book", limiter, async (req, res) => {
  const post = await prisma.post.findFirst({
    where: { slug: String(req.params.slug).slice(0, 191), status: "published", publishedAt: { lte: new Date() } },
    select: { googleBooksId: true },
  })
  if (!post?.googleBooksId) {
    res.json({ enabled: false })
    return
  }
  res.json({ enabled: true, ...(await books.details(post.googleBooksId)) })
})
