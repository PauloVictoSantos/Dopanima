import crypto from "node:crypto"
import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import multer from "multer"
import { env } from "../config/env"
import { badRequest } from "../lib/http-error"
import type { MediaType } from "../lib/constants"

export const UPLOAD_PATH = path.resolve(env.UPLOAD_DIR)
fs.mkdirSync(UPLOAD_PATH, { recursive: true })

type Sig = (b: Buffer) => boolean
const at = (b: Buffer, offset: number, text: string) => b.subarray(offset, offset + text.length).toString("latin1") === text
const bytes = (b: Buffer, ...xs: number[]) => xs.every((x, i) => b[i] === x)
const isoBmff: Sig = (b) => at(b, 4, "ftyp")

// [tipo, extensão gravada em disco, assinatura do conteúdo]. SVG fica de fora de propósito: pode carregar scripts.
const ALLOWED: Record<string, [MediaType, string, Sig]> = {
  "image/jpeg": ["image", ".jpg", (b) => bytes(b, 0xff, 0xd8, 0xff)],
  "image/png": ["image", ".png", (b) => bytes(b, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
  "image/gif": ["image", ".gif", (b) => at(b, 0, "GIF87a") || at(b, 0, "GIF89a")],
  "image/webp": ["image", ".webp", (b) => at(b, 0, "RIFF") && at(b, 8, "WEBP")],
  "image/avif": ["image", ".avif", (b) => isoBmff(b) && (at(b, 8, "avif") || at(b, 8, "avis"))],
  "video/mp4": ["video", ".mp4", isoBmff],
  "video/quicktime": ["video", ".mov", isoBmff],
  "video/webm": ["video", ".webm", (b) => bytes(b, 0x1a, 0x45, 0xdf, 0xa3)],
  "audio/mpeg": ["audio", ".mp3", (b) => at(b, 0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)],
  "audio/mp3": ["audio", ".mp3", (b) => at(b, 0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)],
  "audio/wav": ["audio", ".wav", (b) => at(b, 0, "RIFF") && at(b, 8, "WAVE")],
  "audio/x-wav": ["audio", ".wav", (b) => at(b, 0, "RIFF") && at(b, 8, "WAVE")],
  "audio/ogg": ["audio", ".ogg", (b) => at(b, 0, "OggS")],
  "audio/mp4": ["audio", ".m4a", isoBmff],
  "audio/aac": ["audio", ".aac", (b) => b[0] === 0xff && (b[1] & 0xf6) === 0xf0],
  "application/pdf": ["document", ".pdf", (b) => at(b, 0, "%PDF-")],
}

export const mediaTypeOf = (mime: string): MediaType => ALLOWED[mime]?.[0] ?? "document"

export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_PATH,
    // Nome aleatório e extensão derivada do tipo validado: o nome original nunca vira nome de arquivo.
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ALLOWED[file.mimetype]?.[1] ?? ".bin"}`),
  }),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 20, fields: 10, fieldSize: 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) cb(null, true)
    else cb(badRequest(`Tipo de arquivo não permitido: ${file.mimetype || "desconhecido"}`))
  },
})

/**
 * Confere se o conteúdo bate com o tipo declarado (o navegador/cliente pode mentir).
 * Arquivos que não batem são apagados e a requisição inteira falha.
 */
export async function verifyUploads(files: Express.Multer.File[]) {
  const bad: string[] = []
  for (const f of files) {
    const handle = await fsp.open(f.path, "r")
    const head = Buffer.alloc(32)
    await handle.read(head, 0, 32, 0).finally(() => handle.close())
    if (!ALLOWED[f.mimetype]?.[2](head)) bad.push(f.originalname)
  }
  if (bad.length) {
    await Promise.all(files.map((f) => fsp.unlink(f.path).catch(() => {})))
    throw badRequest(`O conteúdo não corresponde ao tipo do arquivo: ${bad.join(", ")}`)
  }
}
