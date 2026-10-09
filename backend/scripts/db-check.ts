// Testa a conexão com o banco da DATABASE_URL: npm run db:check

import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const url = process.env.DATABASE_URL ?? ""

async function main() {
  console.log(`Conectando em ${url.replace(/\/\/([^:]+):[^@]*@/, "//$1:****@")} ...`)
  const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`SELECT VERSION() AS version`
  console.log(`✓ Conectado. MySQL ${version}`)
  try {
    const [users, posts] = await Promise.all([prisma.user.count(), prisma.post.count()])
    console.log(`✓ Tabelas encontradas: ${users} usuários, ${posts} posts`)
  } catch {
    console.log("! Conectou, mas as tabelas ainda não existem. Rode: npm run db:migrate")
  }
}

main()
  .catch((e) => {
    console.error("✗ Falha na conexão:", e instanceof Error ? e.message.split("\n").filter(Boolean).pop() : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
