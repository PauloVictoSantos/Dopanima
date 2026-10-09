import { prisma } from "./prisma"

export const slugify = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

/** Slug único de post: acrescenta -2, -3... quando já existe. */
export async function uniquePostSlug(base: string, ignoreId?: number) {
  const root = slugify(base) || "post"
  for (let n = 1; ; n++) {
    const slug = n === 1 ? root : `${root}-${n}`
    const hit = await prisma.post.findUnique({ where: { slug }, select: { id: true } })
    if (!hit || hit.id === ignoreId) return slug
  }
}
