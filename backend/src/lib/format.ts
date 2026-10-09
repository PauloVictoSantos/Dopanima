const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** Date → "04 out 2026" */
export const dateLabel = (d: Date | null | undefined) =>
  d ? `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : ""

/** Date → "YYYY-MM-DD" (horário local do servidor). */
export const isoDay = (d: Date | null | undefined) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : ""

export const initials = (name: string) =>
  name
    .replace(/[^A-Za-zÀ-ú ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?"

export const fmtSize = (b: number) =>
  b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"

/** "agora", "há 8 min", "ontem", "há 3 dias"... para último acesso. */
export function relativeTime(d: Date | null | undefined, now = new Date()) {
  if (!d) return "nunca"
  const min = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (min < 2) return "agora"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const days = Math.floor(h / 24)
  if (days === 1) return "ontem"
  if (days < 30) return `há ${days} dias`
  return dateLabel(d)
}

const zoneParts = (at: Date, timeZone: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  )

/**
 * Converte data + hora "de parede" num fuso IANA para um instante UTC.
 * Ex.: ("2026-10-10", "19:30", "America/Manaus") → 2026-10-10T23:30:00Z
 */
export function zonedToUtc(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number)
  const [hh, mm] = (time || "00:00").split(":").map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const p = zoneParts(new Date(guess), timeZone)
  const asZone = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  return new Date(guess - (asZone - guess))
}

/** Inverso de zonedToUtc: instante UTC → { date, time } no fuso. */
export function utcToZoned(at: Date, timeZone: string) {
  const p = zoneParts(at, timeZone)
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}
