import { Router } from "express"
import { z } from "zod"
import { authenticate, requirePermission } from "../../middlewares/auth"
import { badRequest, conflict, notFound } from "../../lib/http-error"
import { prisma } from "../../lib/prisma"
import { slugify } from "../../lib/slug"
import { idParam, parse } from "../../lib/validate"

const inputSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à categoria").max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).default(""),
  parentId: z.number().int().positive().nullable().default(null),
  imageUrl: z.string().trim().max(500).default(""),
  color: z.string().trim().max(20).default(""),
})

const LIVE = { status: { not: "trash" } }

/** Lista plana em ordem de árvore: cada principal seguida das filhas. */
export async function listCategories() {
  const all = await prisma.category.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    include: { _count: { select: { posts: { where: LIVE }, subPosts: { where: LIVE } } } },
  })
  const dto = (c: (typeof all)[number]) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    color: c.color,
    position: c.position,
    parentId: c.parentId,
    count: c.parentId ? c._count.subPosts : c._count.posts,
  })
  return all.filter((c) => !c.parentId).flatMap((root) => [dto(root), ...all.filter((c) => c.parentId === root.id).map(dto)])
}

async function validate(data: z.infer<typeof inputSchema>, id?: number) {
  const slug = slugify(data.slug || data.name)
  if (!slug) throw badRequest("Slug inválido")
  if (data.parentId) {
    if (data.parentId === id) throw badRequest("Uma categoria não pode ser pai dela mesma")
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } })
    if (!parent) throw badRequest("Categoria pai não encontrada")
    if (parent.parentId) throw badRequest("Só são permitidos dois níveis: escolha uma categoria principal como pai")
    if (id && (await prisma.category.count({ where: { parentId: id } }))) throw badRequest("Esta categoria tem filhas; ela precisa continuar principal")
  }
  const clash = await prisma.category.findFirst({ where: { slug, parentId: data.parentId, NOT: id ? { id } : undefined } })
  if (clash) throw conflict(`Já existe a categoria "${clash.name}" com esse slug nesse nível`)
  return { ...data, slug }
}

export const categoriesRouter = Router()

categoriesRouter.get("/", authenticate, async (_req, res) => {
  res.json(await listCategories())
})

categoriesRouter.post("/", authenticate, requirePermission("taxonomy"), async (req, res) => {
  const data = await validate(parse(inputSchema, req.body))
  const last = await prisma.category.aggregate({ where: { parentId: data.parentId }, _max: { position: true } })
  const cat = await prisma.category.create({ data: { ...data, position: (last._max.position ?? -1) + 1 } })
  res.status(201).json(cat)
})

categoriesRouter.put("/:id", authenticate, requirePermission("taxonomy"), async (req, res) => {
  const id = idParam(req.params.id)
  if (!(await prisma.category.findUnique({ where: { id } }))) throw notFound("Categoria não encontrada")
  const data = await validate(parse(inputSchema, req.body), id)
  res.json(await prisma.category.update({ where: { id }, data }))
})

/** Troca a posição com a irmã anterior (up) ou seguinte (down). */
categoriesRouter.post("/:id/move", authenticate, requirePermission("taxonomy"), async (req, res) => {
  const id = idParam(req.params.id)
  const { direction } = parse(z.object({ direction: z.enum(["up", "down"]) }), req.body)
  const cat = await prisma.category.findUnique({ where: { id } })
  if (!cat) throw notFound("Categoria não encontrada")
  const siblings = await prisma.category.findMany({ where: { parentId: cat.parentId }, orderBy: [{ position: "asc" }, { id: "asc" }] })
  const i = siblings.findIndex((s) => s.id === id)
  const j = direction === "up" ? i - 1 : i + 1
  if (j >= 0 && j < siblings.length) {
    const order = [...siblings]
    ;[order[i], order[j]] = [order[j], order[i]]
    await prisma.$transaction(order.map((s, pos) => prisma.category.update({ where: { id: s.id }, data: { position: pos } })))
  }
  res.json(await listCategories())
})

categoriesRouter.delete("/:id", authenticate, requirePermission("taxonomy"), async (req, res) => {
  const id = idParam(req.params.id)
  if (!(await prisma.category.findUnique({ where: { id } }))) throw notFound("Categoria não encontrada")
  // Filhas são removidas em cascata; posts ficam sem categoria (SetNull).
  await prisma.category.delete({ where: { id } })
  res.status(204).end()
})
