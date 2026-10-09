import { Router, type RequestHandler } from "express"
import { z } from "zod"
import { authenticate, requirePermission } from "../../middlewares/auth"
import { idParam, parse } from "../../lib/validate"
import * as service from "./users.service"

export const usersRouter = Router()

usersRouter.use(authenticate)

// Lista enxuta para o seletor de autor do editor (qualquer membro da equipe).
usersRouter.get("/authors", requirePermission("create", "editOwn", "editAll"), async (_req, res) => {
  res.json(await service.listAuthors())
})

usersRouter.use(requirePermission("users"))

usersRouter.get("/", async (req, res) => {
  res.json(await service.listUsers(parse(service.listSchema, req.query)))
})

usersRouter.get("/stats", async (_req, res) => {
  res.json(await service.userStats())
})

usersRouter.get("/:id", async (req, res) => {
  res.json(await service.getUser(idParam(req.params.id)))
})

usersRouter.post("/", async (req, res) => {
  res.status(201).json(await service.createUser(parse(service.createSchema, req.body)))
})

const update: RequestHandler = async (req, res) => {
  res.json(await service.updateUser(req.user!, idParam(req.params.id), parse(service.updateSchema, req.body)))
}
usersRouter.put("/:id", update)
usersRouter.patch("/:id", update)

usersRouter.post("/:id/reset-password", async (req, res) => {
  res.json(await service.resetPassword(idParam(req.params.id)))
})

usersRouter.post("/bulk", async (req, res) => {
  const { ids, action } = parse(
    z.object({ ids: z.array(z.number().int().positive()).min(1), action: z.enum(["activate", "suspend", "delete"]) }),
    req.body
  )
  if (action === "delete") {
    await service.deleteUsers(req.user!, ids)
    res.json({ deleted: ids.length })
    return
  }
  res.json(await service.bulkStatus(req.user!, ids, action === "activate" ? "active" : "suspended"))
})

usersRouter.delete("/:id", async (req, res) => {
  await service.deleteUsers(req.user!, [idParam(req.params.id)])
  res.status(204).end()
})
