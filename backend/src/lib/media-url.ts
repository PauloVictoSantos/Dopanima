import { env } from "../config/env"

/** URL pública de uma mídia: externa (seed/importação) ou servida em /uploads. */
export const mediaUrl = (m: { externalUrl: string; filename: string }) =>
  m.externalUrl || (m.filename ? `${env.API_URL}/uploads/${encodeURIComponent(m.filename)}` : "")
