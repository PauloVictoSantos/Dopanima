import { Router } from "express"
import { z } from "zod"
import { authenticate, requirePermission } from "../../middlewares/auth"
import { idParam, parse } from "../../lib/validate"
import * as service from "./comments.service"

export const commentsRouter = Router()

commentsRouter.use(authenticate, requirePermission("moderate"))

commentsRouter.get("/", async (req, res) => {
  res.json(await service.listComments(parse(service.listSchema, req.query)))
})

commentsRouter.get("/settings", async (_req, res) => {
  res.json(await service.getModeration())
})

commentsRouter.put("/settings", async (req, res) => {
  res.json(await service.saveModeration(parse(service.moderationSchema, req.body)))
})

commentsRouter.post("/bulk", async (req, res) => {
  const { ids, action } = parse(
    z.object({ ids: z.array(z.number().int().positive()).min(1).max(500), action: z.enum(["approve", "pending", "spam", "trash", "delete"]) }),
    req.body
  )
  if (action === "delete") {
    res.json(await service.removeComments(ids))
    return
  }
  res.json(await service.setStatus(ids, action === "approve" ? "approved" : action))
})

commentsRouter.patch("/:id", async (req, res) => {
  const { status } = parse(z.object({ status: z.enum(service.COMMENT_STATUSES) }), req.body)
  res.json(await service.setStatus([idParam(req.params.id)], status))
})

commentsRouter.post("/:id/reply", async (req, res) => {
  const { content } = parse(z.object({ content: z.string().trim().min(1, "Escreva a resposta").max(2000) }), req.body)
  res.status(201).json(await service.reply(req.user!, idParam(req.params.id), content))
})

commentsRouter.delete("/:id", async (req, res) => {
  await service.removeComments([idParam(req.params.id)])
  res.status(204).end()
})
