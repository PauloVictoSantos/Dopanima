import { z } from "zod"
import { badRequest } from "./http-error"

/** Valida `data` com o schema; erros viram 400 pelo error handler. */
export const parse = <T extends z.ZodType>(schema: T, data: unknown): z.infer<T> => schema.parse(data)

/** Lê um parâmetro de rota numérico (ex.: /posts/:id). */
export function idParam(value: unknown) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw badRequest("ID inválido")
  return id
}

/** Booleanos vindos de query string ("true"/"false"/"1"/"0"). */
export const queryBool = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === "true" || v === "1")
