// Recalcula dados derivados a partir da fonte real: comentários aprovados por post.
// Uso: npm run db:recount
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const posts = await prisma.post.findMany({ select: { id: true, title: true, commentsCount: true } })
  for (const p of posts) {
    const n = await prisma.comment.count({ where: { postId: p.id, status: "approved" } })
    if (n !== p.commentsCount) {
      await prisma.post.update({ where: { id: p.id }, data: { commentsCount: n } })
      console.log(`"${p.title}": comentários ${p.commentsCount} → ${n}`)
    }
  }
  console.log(`${posts.length} post(s) verificados.`)
}

main().finally(() => prisma.$disconnect())
