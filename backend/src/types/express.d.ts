import type { Role } from "../lib/constants"

declare global {
  namespace Express {
    interface Request {
      /** Usuário autenticado (preenchido pelo middleware `authenticate`). */
      user?: { id: number; role: Role; name: string; email: string }
    }
  }
}

export {}
