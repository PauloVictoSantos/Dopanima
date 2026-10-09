export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details)
export const unauthorized = (msg = "Faça login para continuar") => new HttpError(401, msg)
export const forbidden = (msg = "Você não tem permissão para esta ação") => new HttpError(403, msg)
export const notFound = (msg = "Não encontrado") => new HttpError(404, msg)
export const conflict = (msg: string) => new HttpError(409, msg)
