// Types, labels and formatting helpers for the admin panel (/painel). Posts,
// categories, tags, media, users and SEO come from the API (lib/dashboard-api.ts);
// the remaining sample data (comments, notifications, permissions...) is still demo content.

export type PostKind = "Filme" | "Livro" | "Série" | "Notícia"
export type PostStatus = "Publicado" | "Agendado" | "Em revisão" | "Rascunho" | "Arquivado" | "Lixeira"

export type DashPost = {
  id: number
  title: string
  slug: string
  img: string
  cat: PostKind
  author: string
  authorId: number
  /** Publication (or scheduled) day as YYYY-MM-DD, empty when unset. */
  date: string
  views: number
  comments: number
  /** Engagement rate, in percent. */
  eng: number
  seo: number
  status: PostStatus
  tags: string[]
  created: string
  updated: string
  sched: { date: string; time: string } | null
  /** Editor content (only on the single-post endpoint). */
  html?: string
  excerpt?: string
  sub?: string
}

export type Category = { id: number; name: string; slug: string; parent: number; desc: string; count: number; img: string; color: string }
export type TagItem = { id: number; name: string; slug: string; count: number }
export type MediaKind = "Imagem" | "Vídeo" | "Áudio" | "Documento"
export type MediaItem = {
  id: number
  name: string
  url: string
  type: MediaKind
  size: string
  dims: string
  date: string
  author: string
  folder: string
  alt: string
  caption: string
  desc: string
  /** Posts that use it as featured image. */
  usedIn: number
}
export type CommentStatus = "pending" | "approved" | "spam" | "trash"
export type DashComment = {
  id: number
  name: string
  ini: string
  color: string
  email: string
  post: string
  time: string
  text: string
  status: CommentStatus
  replies: { who: string; text: string }[]
}

// ---------- palette & labels ----------

export const CAT_COLOR: Record<PostKind, string> = { Filme: "#FF5A36", Livro: "#F7E27A", Série: "#8BE04E", Notícia: "#C9A0E0" }
export const TYPE2CAT: Record<PostKind, string> = { Filme: "Filmes", Livro: "Livros", Série: "Séries", Notícia: "Notícias" }
export const POST_KINDS = Object.keys(CAT_COLOR) as PostKind[]
export const STATUS_COLOR: Record<PostStatus, string> = {
  Publicado: "#8BE04E",
  Agendado: "#F7E27A",
  "Em revisão": "#C9A0E0",
  Rascunho: "#CFCFCF",
  Arquivado: "#9C8AA6",
  Lixeira: "#FF8A73",
}
export const COMMENT_STATUS: Record<CommentStatus, [string, string]> = {
  pending: ["Pendente", "#F7E27A"],
  approved: ["Aprovado", "#8BE04E"],
  spam: ["Spam", "#FF8A73"],
  trash: ["Lixeira", "#9C8AA6"],
}
export const TIMEZONES = ["America/Manaus", "America/Sao_Paulo", "America/Fortaleza", "America/Rio_Branco"]

// ---------- formatting ----------

const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

export const nf = (n: number) => Math.round(n).toLocaleString("pt-BR")

/** "2026-10-05" → "5 out" (adds the year outside 2026). */
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-")
  if (!d) return "—"
  return `${Number(d)} ${MON[Number(m) - 1]}${y === "2026" ? "" : " " + y}`
}

export const monthShort = (iso: string) => MON[Number(iso.slice(5, 7)) - 1]

export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const newId = () => Date.now()

export const nowTime = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

export const slugify = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export const fmtSize = (b: number) =>
  b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"

export const seoColor = (n: number) => (n >= 80 ? "#8BE04E" : n >= 65 ? "#F7E27A" : "#FF8A73")

export const thumbBg = (url: string) => (url ? `url("${url}") center/cover no-repeat, #3B0A45` : "#3B0A45")

export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

export const wordCount = (html: string) =>
  (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim().split(/\s+/).filter(Boolean).length


// ---------- charts ----------

export type PeriodKey = "hoje" | "semana" | "mes"
export const PERIODS: Record<
  PeriodKey,
  {
    label: string
    range: string
    chartSub: string
    views: string
    vd: string
    likes: string
    ld: string
    shares: string
    sd: string
    users: string
    pd: string
    sub: string
    n: number
    base: number
    ticks: string[]
    lab: (i: number) => string
    mult: number
  }
> = {
  hoje: {
    label: "Hoje", range: "Hoje", chartSub: "Hoje, por hora",
    views: "4.812", vd: "+6,1%", likes: "612", ld: "+3,4%", shares: "148", sd: "+9,8%", users: "+21", pd: "+3", sub: "vs. ontem",
    n: 24, base: 200, ticks: ["0h", "4h", "8h", "12h", "16h", "20h", "23h"], lab: (i) => `${i}h`, mult: 0.04,
  },
  semana: {
    label: "Semana", range: "Últimos 7 dias", chartSub: "Últimos 7 dias",
    views: "31.906", vd: "+9,7%", likes: "4.210", ld: "+7,2%", shares: "1.022", sd: "+11,3%", users: "+164", pd: "+14", sub: "vs. semana passada",
    n: 7, base: 4500, ticks: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
    lab: (i) => ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"][i], mult: 0.25,
  },
  mes: {
    label: "Mês", range: "Últimos 30 dias", chartSub: "Últimos 30 dias",
    views: "128.492", vd: "+12,4%", likes: "16.904", ld: "+10,6%", shares: "4.371", sd: "−2,3%", users: "+702", pd: "+8,2%", sub: "vs. mês passado",
    n: 30, base: 4300, ticks: ["1 set", "5", "10", "15", "20", "25", "30"], lab: (i) => `${i + 1} de setembro`, mult: 1,
  },
}

/** Deterministic pseudo-random series, so server and client renders match. */
export function series(n: number, base: number, seed: number, trend: number) {
  let s = seed
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280
  return Array.from({ length: n }, (_, i) => {
    const daily = n === 24 ? 0.4 + Math.sin(((i - 6) / 24) * Math.PI * 2) * 0.35 + 0.4 : 1
    return base * (1 + (trend * i) / n) * (0.75 + r() * 0.5) * daily
  })
}

export const linePath = (v: number[], max: number, w: number, h: number) =>
  v.map((y, i) => `${i ? "L" : "M"}${((i / (v.length - 1)) * w).toFixed(1)},${(h - (y / max) * h).toFixed(1)}`).join("")

export function sparkPath(seed: number) {
  const v = series(12, 10, seed, 0.4)
  return linePath(v, Math.max(...v) * 1.1, 100, 32)
}

export const SEED_PROFILE = {
  name: "Lia Moreno",
  email: "lia@dopanima.com",
  site: "dopanima.com/autora/lia",
  insta: "@liamoreno",
  x: "@liamoreno",
  bio: "Editora-chefe do Dopanima. Assiste a tudo com legenda e lê três livros ao mesmo tempo.",
  photo: "",
  nComments: true,
  nWeekly: true,
  nSched: false,
}

export const SEED_SETTINGS = {
  siteName: "Dopanima",
  tagline: "Filmes, livros e notícias em um só lugar.",
  url: "https://dopanima.com",
  perPage: "12",
  tz: "America/Manaus",
  lang: "pt-BR",
  metaTpl: "%titulo% | Dopanima",
  metaDesc: "Resenhas, listas e notícias de filmes, séries e livros.",
  ogImg: "https://dopanima.com/og-padrao.jpg",
  index: true,
  sitemap: true,
  comments: true,
  newsletter: true,
  related: true,
  readTime: true,
  twofa: false,
  maint: false,
  sessions: [
    { id: 1, device: "Chrome · macOS", meta: "Manaus, AM · agora", current: true },
    { id: 2, device: "Safari · iPhone", meta: "Manaus, AM · ontem, 22:14", current: false },
  ],
}

export type Profile = typeof SEED_PROFILE
export type Settings = typeof SEED_SETTINGS

export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

// ---------- notifications ----------

export type NotifType = "comment" | "spam" | "post" | "sched" | "system" | "seo" | "user"
export type NotifGroup = "comment" | "post" | "system"
export type DashNotif = { id: number; type: NotifType; title: string; desc: string; time: string; unread: boolean; href: string }

export const NOTIF_META: Record<NotifType, { color: string; group: NotifGroup }> = {
  comment: { color: "#C9A0E0", group: "comment" },
  spam: { color: "#FF8A73", group: "comment" },
  post: { color: "#F7E27A", group: "post" },
  sched: { color: "#F7E27A", group: "post" },
  system: { color: "#8BE04E", group: "system" },
  seo: { color: "#FF5A36", group: "system" },
  user: { color: "#8BE04E", group: "system" },
}

export const SEED_NOTIFS: DashNotif[] = (
  [
    ["comment", 'Rafa Lins comentou em "Duna"', '"A parte do som no deserto ficou incrível na resenha..."', "há 8 min", true, "/painel/comentarios"],
    ["comment", 'Júlia Prado comentou em "It: A Coisa"', '"Li na adolescência e até hoje lembro do capítulo do esgoto."', "há 24 min", true, "/painel/comentarios"],
    ["spam", "Comentário marcado como spam", 'promo_link99 em "O Justiceiro" foi bloqueado pelo filtro.', "há 41 min", true, "/painel/comentarios"],
    ["post", "Bia Tavares enviou um post para revisão", '"Vingadores: Doutor Destino — o que sabemos"', "há 1 h", true, "/painel/posts"],
    ["sched", "Publicação agendada confirmada", '"Avatar: Fogo e Cinzas — os bastidores" vai ao ar em 10 out, 19:30.', "há 2 h", false, "/painel/agendamento"],
    ["system", "2 imagens sem texto alternativo", 'Em "Moana" e "The Flash". Isso afeta acessibilidade e SEO.', "há 3 h", false, "/painel/midia"],
    ["user", "23 novos leitores cadastrados", "Total de 8.430 usuários.", "há 3 h", false, ""],
    ["system", "Backup concluído", "Hoje às 03:00, 1,8 GB.", "há 5 h", false, ""],
    ["seo", "4 posts com SEO abaixo de 65", "Revise meta description e links internos.", "ontem", false, "/painel/seo"],
    ["post", 'Caio Ventura publicou "It: A Coisa"', "O post já tem 15 mil visualizações.", "1 out", false, "/painel/posts"],
  ] as [NotifType, string, string, string, boolean, string][]
).map(([type, title, desc, time, unread, href], i) => ({ id: i + 1, type, title, desc, time, unread, href }))

export const SEED_NOTIF_PREFS = { comments: true, review: true, sched: true, system: true, weekly: false }
export type NotifPrefs = typeof SEED_NOTIF_PREFS

// ---------- roles & permissions ----------

export const ROLES = ["Super Admin", "Editor", "Autor", "Revisor", "Colaborador"] as const
export type Role = (typeof ROLES)[number]
export type UserRole = Role | "Leitor"
export const USER_ROLES: UserRole[] = [...ROLES, "Leitor"]

export const ROLE_DESC: Record<Role, string> = {
  "Super Admin": "Acesso total ao painel, inclusive usuários e configurações.",
  Editor: "Gerencia todo o conteúdo e a moderação.",
  Autor: "Escreve, agenda e publica os próprios posts.",
  Revisor: "Revisa textos de outros autores e modera comentários.",
  Colaborador: "Escreve rascunhos e envia para revisão.",
}

// [key, label, group]
export const PERMISSIONS: [string, string, string][] = [
  ["create", "Criar posts", "Conteúdo"],
  ["editOwn", "Editar os próprios posts", "Conteúdo"],
  ["editAll", "Editar posts de outros autores", "Conteúdo"],
  ["publish", "Publicar", "Conteúdo"],
  ["schedule", "Agendar", "Conteúdo"],
  ["delete", "Excluir posts", "Conteúdo"],
  ["taxonomy", "Gerenciar categorias e tags", "Organização"],
  ["media", "Enviar e gerenciar mídia", "Organização"],
  ["moderate", "Moderar comentários", "Comunidade"],
  ["users", "Gerenciar usuários", "Comunidade"],
  ["seo", "Editar SEO do site", "Sistema"],
  ["analytics", "Ver analytics", "Sistema"],
  ["settings", "Alterar configurações", "Sistema"],
]

export type PermMatrix = Record<Role, Record<string, boolean>>
const grant = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, true]))
const ALL_PERMS = grant(PERMISSIONS.map((p) => p[0]))
export const SEED_PERMS: PermMatrix = {
  "Super Admin": ALL_PERMS,
  Editor: { ...ALL_PERMS, users: false, settings: false },
  Autor: grant(["create", "editOwn", "publish", "schedule", "media", "analytics"]),
  Revisor: grant(["editAll", "moderate", "analytics"]),
  Colaborador: grant(["create", "editOwn"]),
}

export type TeamMember = { id: number; name: string; email: string; role: Role; ini: string; color: string; last: string }
export const SEED_TEAM: TeamMember[] = (
  [
    [1, "Lia Moreno", "lia@dopanima.com", "Super Admin", "LM", "#B5179E", "online agora"],
    [2, "Caio Ventura", "caio@dopanima.com", "Editor", "CV", "#5A0F6E", "há 40 min"],
    [3, "Bia Tavares", "bia@dopanima.com", "Autor", "BT", "#7A2E8E", "há 2 h"],
    [4, "Rafa Lins", "rafa@dopanima.com", "Revisor", "RL", "#3B0A45", "ontem"],
    [5, "Duda Campos", "duda@dopanima.com", "Colaborador", "DC", "#7A1F3D", "há 3 dias"],
  ] as [number, string, string, Role, string, string, string][]
).map(([id, name, email, role, ini, color, last]) => ({ id, name, email, role, ini, color, last }))

/** The signed-in demo account; it can't change its own role or delete itself. */
export const SELF_ID = 1

// ---------- users ----------

export type UserStatus = "Ativo" | "Pendente" | "Suspenso"
export type DashUser = {
  id: number
  name: string
  email: string
  role: UserRole
  status: UserStatus
  joined: string
  last: string
  comments: number
  city: string
  ini: string
  color: string
  /** Posts written (team members). */
  posts: number
}

export const USER_ROLE_STYLE: Record<UserRole, [string, string]> = {
  "Super Admin": ["#B5179E", "#fff"],
  Editor: ["#5A0F6E", "#fff"],
  Autor: ["#FF5A36", "#fff"],
  Revisor: ["#C9A0E0", "#1A0522"],
  Colaborador: ["#F7E27A", "#1A0522"],
  Leitor: ["rgba(255,255,255,.12)", "#fff"],
}
export const USER_STATUS_COLOR: Record<UserStatus, string> = { Ativo: "#8BE04E", Pendente: "#F7E27A", Suspenso: "#FF8A73" }
export const USER_COLORS = ["#5A0F6E", "#B5179E", "#7A2E8E", "#3B0A45", "#7A1F3D", "#26113A"]
