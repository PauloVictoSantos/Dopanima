import { z } from "zod"
import { env } from "../../config/env"
import { prisma } from "../../lib/prisma"

export const settingsSchema = z.object({
  siteName: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(200),
  siteUrl: z.url("Informe uma URL válida (https://...)"),
  titleTemplate: z.string().trim().max(120).refine((v) => v.includes("%titulo%"), "O modelo precisa conter %titulo%"),
  defaultMetaDescription: z.string().trim().max(320),
  ogImage: z.string().trim().max(500),
  robots: z.string().max(5000),
})
export type SiteSettings = z.infer<typeof settingsSchema>

export const defaultSettings = (): SiteSettings => ({
  siteName: "Dopanima",
  tagline: "Filmes, livros e notícias em um só lugar.",
  siteUrl: env.FRONTEND_URL,
  titleTemplate: "%titulo% | Dopanima",
  defaultMetaDescription: "Resenhas, listas e notícias de filmes, séries e livros.",
  ogImage: "",
  robots: `User-agent: *\nAllow: /\nDisallow: /painel/\nDisallow: /login\nSitemap: ${env.FRONTEND_URL}/sitemap.xml`,
})

export async function getSettings(): Promise<SiteSettings> {
  const rows = await prisma.setting.findMany()
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]))
  return { ...defaultSettings(), ...stored }
}

export async function updateSettings(patch: Partial<SiteSettings>) {
  const data = settingsSchema.partial().parse(patch)
  await prisma.$transaction(
    Object.entries(data).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } })
    )
  )
  return getSettings()
}
