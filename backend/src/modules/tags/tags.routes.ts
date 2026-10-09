import { Router } from "express"
import { z } from "zod"
import { authenticate, requirePermission } from "../../middlewares/auth"
import { badRequest, conflict, notFound } from "../../lib/http-error"
import { prisma } from "../../lib/prisma"
import { slugify } from "../../lib/slug"
import { idParam, parse } from "../../lib/validate"

const inputSchema = z.object({
  name: z.string().trim().min(1, "Digite o nome da tag").max(50).transform((n) => n.replace(/^#/, "").toLowerCase()),
  slug: z.string().trim().max(60).optional(),
})

export async function listTags(q = "") {
  const tags = await prisma.tag.findMany({
    where: q ? { name: { contains: q.toLowerCase() } } : undefined,
    include: { _count: { select: { posts: { where: { post: { status: { not: "trash" } } } } } } },
  })
  return tags
    .map((t) => ({ id: t.id, name: t.name, slug: t.slug, count: t._count.posts }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

async function validate(data: z.infer<typeof inputSchema>, id?: number) {
  const slug = slugify(data.slug || data.name)
  if (!slug) throw badRequest("Slug inválido")
  const clash = await prisma.tag.findFirst({ where: { OR: [{ name: data.name }, { slug }], NOT: id ? { id } : undefined } })
  if (clash) throw conflict(`A tag #${clash.name} já existe`)
  return { name: data.name, slug }
}

export const tagsRouter = Router()

tagsRouter.get("/", authenticate, async (req, res) => {
  res.json(await listTags(parse(z.object({ q: z.string().trim().default("") }), req.query).q))
})

tagsRouter.post("/", authenticate, requirePermission("taxonomy"), async (req, res) => {
  const data = await validate(parse(inputSchema, req.body))
  res.status(201).json({ ...(await prisma.tag.create({ data })), count: 0 })
})

tagsRouter.put("/:id", authenticate, requirePermission("taxonomy"), async (req, res) => {
  const id = idParam(req.params.id)
  if (!(await prisma.tag.findUnique({ where: { id } }))) throw notFound("Tag não encontrada")
  const data = await validate(parse(inputSchema, req.body), id)
  res.json(await prisma.tag.update({ where: { id }, data }))
})

tagsRouter.delete("/:id", authenticate, requirePermission("taxonomy"), async (req, res) => {
  const id = idParam(req.params.id)
  if (!(await prisma.tag.findUnique({ where: { id } }))) throw notFound("Tag não encontrada")
  await prisma.tag.delete({ where: { id } })
  res.status(204).end()
})
