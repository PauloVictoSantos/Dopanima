import fs from "node:fs/promises"
import path from "node:path"
import { Router } from "express"
import { imageSizeFromFile } from "image-size/fromFile"
import type { Media, Prisma } from "@prisma/client"
import { z } from "zod"
import { authenticate, requirePermission } from "../../middlewares/auth"
import { UPLOAD_PATH, mediaTypeOf, upload, verifyUploads } from "../../middlewares/upload"
import { MEDIA_TYPES, can } from "../../lib/constants"
import { dateLabel, fmtSize } from "../../lib/format"
import { badRequest, forbidden, notFound } from "../../lib/http-error"
import { mediaUrl } from "../../lib/media-url"
import { prisma } from "../../lib/prisma"
import { idParam, parse, queryBool } from "../../lib/validate"
import { refreshPostSeo } from "../seo/seo.service"

const DEFAULT_FOLDERS = ["Capas", "Notícias", "Geral"]

type MediaRow = Media & { uploader: { name: string } | null; _count: { covers: number } }

const toDto = (m: MediaRow) => ({
  id: m.id,
  name: m.name,
  url: mediaUrl(m),
  type: m.type,
  mimeType: m.mimeType,
  size: m.size,
  sizeLabel: m.size ? fmtSize(m.size) : "—",
  width: m.width,
  height: m.height,
  dims: m.width && m.height ? `${m.width}×${m.height}` : "—",
  alt: m.alt,
  caption: m.caption,
  description: m.description,
  folder: m.folder,
  author: m.uploader?.name ?? "—",
  usedIn: m._count.covers,
  createdAt: m.createdAt,
  dateLabel: dateLabel(m.createdAt),
})

const include = { uploader: { select: { name: true } }, _count: { select: { covers: true } } } satisfies Prisma.MediaInclude

async function dimensions(file: string, type: string) {
  if (type !== "image") return { width: null, height: null }
  try {
    const d = await imageSizeFromFile(file)
    return { width: d.width ?? null, height: d.height ?? null }
  } catch {
    return { width: null, height: null }
  }
}

async function removeFile(filename: string) {
  if (!filename) return
  await fs.unlink(path.join(UPLOAD_PATH, path.basename(filename))).catch(() => {})
}

const listSchema = z.object({
  type: z.enum([...MEDIA_TYPES, "all"]).default("all"),
  folder: z.string().trim().default(""),
  q: z.string().trim().default(""),
  missingAlt: queryBool.optional(),
})

const patchSchema = z
  .object({
    name: z.string().trim().min(1, "O nome não pode ficar vazio").max(200),
    alt: z.string().trim().max(300),
    caption: z.string().trim().max(500),
    description: z.string().trim().max(2000),
    folder: z.string().trim().min(1).max(60),
  })
  .partial()

/** Autores mexem só nos próprios arquivos; quem edita tudo (editor/admin) mexe em qualquer um. */
function assertOwner(req: Express.Request, uploaderId: number | null) {
  if (!can(req.user!.role, "editAll") && uploaderId !== req.user!.id) throw forbidden("Você só pode alterar arquivos que você enviou")
}

// Remove caracteres de controle e separadores de caminho do nome exibido.
const cleanName = (n: string) => n.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim().slice(0, 200) || "arquivo"

export const mediaRouter = Router()

mediaRouter.use(authenticate)

mediaRouter.get("/", async (req, res) => {
  const q = parse(listSchema, req.query)
  const where: Prisma.MediaWhereInput = {
    ...(q.type !== "all" ? { type: q.type } : {}),
    ...(q.folder ? { folder: q.folder } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q } }, { alt: { contains: q.q } }, { caption: { contains: q.q } }] } : {}),
    ...(q.missingAlt ? { type: "image", alt: "" } : {}),
  }
  const [items, total, missingAlt] = await Promise.all([
    prisma.media.findMany({ where, include, orderBy: { createdAt: "desc" } }),
    prisma.media.count(),
    prisma.media.count({ where: { type: "image", alt: "" } }),
  ])
  res.json({ items: items.map(toDto), total, missingAlt })
})

mediaRouter.get("/folders", async (_req, res) => {
  const rows = await prisma.media.findMany({ distinct: ["folder"], select: { folder: true } })
  res.json([...new Set([...DEFAULT_FOLDERS, ...rows.map((r) => r.folder)])])
})

mediaRouter.get("/:id", async (req, res) => {
  const m = await prisma.media.findUnique({ where: { id: idParam(req.params.id) }, include })
  if (!m) throw notFound("Arquivo não encontrado")
  res.json(toDto(m))
})

mediaRouter.post("/", requirePermission("media"), upload.array("files", 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (!files.length) throw badRequest("Envie ao menos um arquivo no campo 'files'")
  await verifyUploads(files)
  const folder = typeof req.body?.folder === "string" && req.body.folder.trim() ? req.body.folder.trim().slice(0, 60) : "Geral"
  const created = []
  for (const f of files) {
    const type = mediaTypeOf(f.mimetype)
    const dims = await dimensions(f.path, type)
    const m = await prisma.media.create({
      data: {
        // multer entrega o nome original em latin1
        name: cleanName(Buffer.from(f.originalname, "latin1").toString("utf8")),
        filename: f.filename,
        mimeType: f.mimetype,
        type,
        size: f.size,
        ...dims,
        folder,
        uploaderId: req.user!.id,
      },
      include,
    })
    created.push(toDto(m))
  }
  res.status(201).json(created)
})

mediaRouter.patch("/:id", requirePermission("media"), async (req, res) => {
  const id = idParam(req.params.id)
  const before = await prisma.media.findUnique({ where: { id }, include: { covers: { select: { id: true } } } })
  if (!before) throw notFound("Arquivo não encontrado")
  assertOwner(req, before.uploaderId)
  const data = parse(patchSchema, req.body)
  if (data.name) data.name = cleanName(data.name)
  const m = await prisma.media.update({ where: { id }, data, include })
  // O alt da capa entra na nota de SEO dos posts que a usam.
  if (data.alt !== undefined && data.alt !== before.alt) await Promise.all(before.covers.map((p) => refreshPostSeo(p.id)))
  res.json(toDto(m))
})

mediaRouter.put("/:id/file", requirePermission("media"), upload.single("file"), async (req, res) => {
  const id = idParam(req.params.id)
  const f = req.file
  if (!f) throw badRequest("Envie o arquivo no campo 'file'")
  const before = await prisma.media.findUnique({ where: { id } })
  if (!before || (!can(req.user!.role, "editAll") && before.uploaderId !== req.user!.id)) {
    await removeFile(f.filename)
    if (!before) throw notFound("Arquivo não encontrado")
    throw forbidden("Você só pode alterar arquivos que você enviou")
  }
  await verifyUploads([f])
  const type = mediaTypeOf(f.mimetype)
  const m = await prisma.media.update({
    where: { id },
    data: { filename: f.filename, externalUrl: "", mimeType: f.mimetype, type, size: f.size, ...(await dimensions(f.path, type)) },
    include,
  })
  await removeFile(before.filename)
  res.json(toDto(m))
})

mediaRouter.delete("/:id", requirePermission("media"), async (req, res) => {
  const id = idParam(req.params.id)
  const m = await prisma.media.findUnique({ where: { id }, include: { covers: { select: { id: true } } } })
  if (!m) throw notFound("Arquivo não encontrado")
  assertOwner(req, m.uploaderId)
  await prisma.media.delete({ where: { id } })
  await removeFile(m.filename)
  await Promise.all(m.covers.map((p) => refreshPostSeo(p.id)))
  res.status(204).end()
})
