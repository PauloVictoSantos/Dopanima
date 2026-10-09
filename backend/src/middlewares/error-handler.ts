import type { NextFunction, Request, Response } from "express"
import { Prisma } from "@prisma/client"
import { MulterError } from "multer"
import { ZodError, z } from "zod"
import { HttpError } from "../lib/http-error"

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? "Dados inválidos", details: z.flattenError(err).fieldErrors })
    return
  }
  if (err instanceof MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Arquivo maior que o limite permitido" : err.message
    res.status(400).json({ error: msg })
    return
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Já existe um registro com esse valor" })
      return
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Registro não encontrado" })
      return
    }
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "JSON inválido" })
    return
  }
  console.error(err)
  res.status(500).json({ error: "Erro interno do servidor" })
}
