import "dotenv/config"
import { z } from "zod"

const WEAK_SECRETS = ["troque-este-segredo", "secret", "changeme"]

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3333),
    API_URL: z.string().default("http://localhost:3333"),
    /** Uma ou mais origens do frontend separadas por vírgula (CORS e proteção CSRF). */
    FRONTEND_URL: z.string().default("http://localhost:3000"),
    DATABASE_URL: z.string(),
    JWT_SECRET: z.string().min(16, "JWT_SECRET precisa ter ao menos 16 caracteres"),
    UPLOAD_DIR: z.string().default("uploads"),
    /** Tamanho máximo de upload, em MB. */
    UPLOAD_MAX_MB: z.coerce.number().default(50),
    /**
     * Quantos proxies confiáveis ficam na frente da API (nginx, load balancer...).
     * 0 = nenhum: o IP vem da conexão e X-Forwarded-For é ignorado (não dá para falsificar
     * o IP e driblar os limites de requisição).
     */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    /** Cookie de sessão só por HTTPS. Padrão: ligado em produção. */
    COOKIE_SECURE: z.enum(["true", "false"]).optional(),
    /**
     * Chave da TMDB (themoviedb.org/settings/api): o "Token de leitura da API" (v4,
     * começa com "eyJ") ou a "Chave da API" (v3). Opcional: sem ela a integração fica desligada.
     */
    TMDB_TOKEN: z.string().trim().optional(),
    TMDB_LANGUAGE: z.string().default("pt-BR"),
    TMDB_REGION: z.string().default("BR"),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === "production" && (e.JWT_SECRET.length < 32 || WEAK_SECRETS.includes(e.JWT_SECRET)))
      ctx.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "Em produção use um JWT_SECRET aleatório com 32+ caracteres" })
  })

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:", z.flattenError(parsed.error).fieldErrors)
  process.exit(1)
}

const trim = (u: string) => u.trim().replace(/\/$/, "")

export const env = {
  ...parsed.data,
  API_URL: trim(parsed.data.API_URL),
  FRONTEND_URL: trim(parsed.data.FRONTEND_URL.split(",")[0]),
  /** Origens autorizadas a chamar a API com cookie. */
  ALLOWED_ORIGINS: parsed.data.FRONTEND_URL.split(",").map(trim).filter(Boolean),
  COOKIE_SECURE: parsed.data.COOKIE_SECURE ? parsed.data.COOKIE_SECURE === "true" : parsed.data.NODE_ENV === "production",
}
