import { createApp } from "./app"
import { env } from "./config/env"
import { startScheduler } from "./jobs/scheduler"
import { prisma } from "./lib/prisma"

const app = createApp()
const server = app.listen(env.PORT, () => {
  console.log(`API do Dopanima em ${env.API_URL} (porta ${env.PORT})`)
})
const scheduler = startScheduler()

const shutdown = async () => {
  clearInterval(scheduler)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
