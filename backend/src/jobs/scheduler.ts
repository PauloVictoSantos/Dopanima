import { TRASH_DAYS, publishDuePosts, purgeOldTrash } from "../modules/posts/posts.service"

/**
 * A cada 30 s publica os posts agendados cujo horário chegou; a cada hora apaga
 * de vez os posts que estão na lixeira há mais de TRASH_DAYS dias.
 */
export function startScheduler(intervalMs = 30_000) {
  let ticks = 0
  const tick = async () => {
    try {
      const n = await publishDuePosts()
      if (n) console.log(`[agendador] ${n} post(s) publicado(s)`)
      if (ticks++ % Math.round(3_600_000 / intervalMs) === 0) {
        const purged = await purgeOldTrash()
        if (purged) console.log(`[agendador] ${purged} post(s) apagados da lixeira (mais de ${TRASH_DAYS} dias)`)
      }
    } catch (err) {
      console.error("[agendador] falhou:", err)
    }
  }
  void tick()
  return setInterval(tick, intervalMs)
}
