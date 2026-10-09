import { Router, type RequestHandler } from "express"
import { authenticate, requirePermission } from "../../middlewares/auth"
import { idParam, parse } from "../../lib/validate"
import * as service from "./posts.service"

export const postsRouter = Router()

postsRouter.use(authenticate, requirePermission("create", "editOwn", "editAll"))

postsRouter.get("/", async (req, res) => {
  res.json(await service.listPosts(req.user!, parse(service.listQuerySchema, req.query)))
})

postsRouter.get("/:id", async (req, res) => {
  res.json(await service.getPost(idParam(req.params.id), req.user!))
})

postsRouter.post("/", async (req, res) => {
  res.status(201).json(await service.createPost(req.user!, parse(service.postCreateSchema, req.body)))
})

// PUT e PATCH aceitam campos parciais; o que não vier mantém o valor atual.
const update: RequestHandler = async (req, res) => {
  res.json(await service.updatePost(req.user!, idParam(req.params.id), parse(service.postPatchSchema, req.body)))
}
postsRouter.put("/:id", update)
postsRouter.patch("/:id", update)

postsRouter.post("/:id/duplicate", async (req, res) => {
  res.status(201).json(await service.duplicatePost(req.user!, idParam(req.params.id)))
})

// Antes de "/:id": esvazia a lixeira (exclusão definitiva).
postsRouter.delete("/trash", async (req, res) => {
  res.json(await service.emptyTrash(req.user!))
})

postsRouter.delete("/:id", async (req, res) => {
  await service.deletePost(req.user!, idParam(req.params.id))
  res.status(204).end()
})
