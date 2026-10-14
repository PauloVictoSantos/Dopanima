// Testes negativos de segurança: sobem a API em memória, criam usuários e posts
// temporários no banco de desenvolvimento e apagam tudo no fim.
// Uso: npm run test:security   (nunca rode contra o banco de produção)

import assert from "node:assert/strict"
import crypto from "node:crypto"
import type { AddressInfo } from "node:net"
import type { Server } from "node:http"
import { after, before, describe, test } from "node:test"
import { env } from "../src/config/env"
import { createApp } from "../src/app"
import { sanitize } from "../src/lib/html"
import { prisma } from "../src/lib/prisma"
import { createRedirect } from "../src/modules/seo/seo.service"
import { hashPassword } from "../src/modules/users/users.service"

if (env.NODE_ENV === "production") throw new Error("Testes de segurança não rodam com NODE_ENV=production")

const TAG = `sectest-${crypto.randomBytes(4).toString("hex")}`
const PASSWORD = `Senha-${crypto.randomBytes(8).toString("hex")}`
const ORIGIN = env.ALLOWED_ORIGINS[0]
const EVIL = "https://evil.example"

let server: Server
let base = ""
const ids = { users: [] as number[], posts: [] as number[] }
const users: Record<string, { id: number; email: string; cookie: string }> = {}

type Opts = { method?: string; body?: unknown; cookie?: string; origin?: string; raw?: BodyInit; headers?: Record<string, string> }
async function call(path: string, o: Opts = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) }
  if (o.body !== undefined) headers["content-type"] = "application/json"
  if (o.cookie) headers.cookie = o.cookie
  headers.origin = o.origin ?? ORIGIN
  const res = await fetch(base + path, { method: o.method ?? "GET", headers, body: o.raw ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined) })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json, text, setCookie: res.headers.getSetCookie() }
}

const cookieFrom = (setCookie: string[], name: string) => setCookie.map((c) => c.split(";")[0]).find((c) => c.startsWith(name + "=")) ?? ""

async function makeUser(key: string, role: string) {
  const email = `${TAG}-${key}@example.test`
  const u = await prisma.user.create({ data: { name: `Teste ${key}`, email, passwordHash: await hashPassword(PASSWORD), role, status: "active" } })
  ids.users.push(u.id)
  const path = role === "reader" ? "/api/public/auth/login" : "/api/auth/login"
  const r = await call(path, { method: "POST", body: { email, password: PASSWORD } })
  assert.equal(r.status, 200, `login de ${key}: ${r.text}`)
  users[key] = { id: u.id, email, cookie: [cookieFrom(r.setCookie, "dopanima_session"), cookieFrom(r.setCookie, "dopanima_device")].filter(Boolean).join("; ") }
}

async function makePost(authorId: number, status: string, title = `${TAG} ${status}`) {
  const p = await prisma.post.create({
    data: { title, slug: `${TAG}-${crypto.randomBytes(3).toString("hex")}`, content: "<p>teste</p>", seoReport: "[]", status, authorId, publishedAt: status === "published" ? new Date() : null },
  })
  ids.posts.push(p.id)
  return p
}

before(async () => {
  server = createApp().listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  await makeUser("contrib", "contributor")
  await makeUser("author", "author")
  await makeUser("reader", "reader")
})

after(async () => {
  await prisma.redirect.deleteMany({ where: { from: { startsWith: `/${TAG}` } } })
  await prisma.comment.deleteMany({ where: { postId: { in: ids.posts } } })
  await prisma.post.deleteMany({ where: { id: { in: ids.posts } } })
  await prisma.post.deleteMany({ where: { authorId: { in: ids.users } } })
  const media = await prisma.media.findMany({ where: { uploaderId: { in: ids.users } } })
  await prisma.media.deleteMany({ where: { id: { in: media.map((m) => m.id) } } })
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } })
  await prisma.$disconnect()
  server.close()
})

describe("XSS: sanitização do HTML dos posts", () => {
  const cases: [string, RegExp][] = [
    ["<script>alert(1)</script><p>ok</p>", /<script/i],
    ['<img src="x" onerror="alert(1)">', /onerror/i],
    ['<a href="javascript:alert(1)">x</a>', /javascript:/i],
    ['<a href="data:text/html,<script>alert(1)</script>">x</a>', /data:/i],
    ['<iframe src="https://evil.example"></iframe>', /<iframe/i],
    ['<svg><script>alert(1)</script></svg>', /<svg|<script/i],
    ['<p style="background:url(javascript:alert(1))">x</p>', /style=/i],
    ['<a href="//evil.example">x</a>', /href="\/\//i],
  ]
  for (const [input, forbidden] of cases) test(`remove: ${input.slice(0, 50)}`, () => assert.doesNotMatch(sanitize(input), forbidden))
  test('link com target=_blank recebe rel="noopener noreferrer"', () => assert.match(sanitize('<a href="https://a.com" target="_blank">x</a>'), /rel="noopener noreferrer"/))
})

describe("Redirecionamentos: sem open redirect perigoso", () => {
  for (const to of ["/\\evil.example", "https://evil.example path"])
    test(`recusa destino ${JSON.stringify(to)}`, async () => assert.rejects(createRedirect(`/${TAG}-r`, to), /Destino inválido/))
  // Estes não são recusados: viram caminhos do próprio site ("/evil.example", "/javascript:...").
  for (const [i, to] of ["//evil.example", "///evil.example", "javascript:alert(1)", "data:text/html,x"].entries())
    test(`neutraliza destino ${JSON.stringify(to)} como caminho local`, async () => {
      const r = await createRedirect(`/${TAG}-n${i}`, to)
      assert.match(r.to, /^\/(?![/\\])/)
    })
  test("recusa origem reservada /api", async () => assert.rejects(createRedirect("/api/x", "/y"), /reservada/))
})

describe("Autenticação e sessão", () => {
  test("painel sem sessão → 401", async () => assert.equal((await call("/api/posts")).status, 401))
  test("token adulterado → 401", async () => assert.equal((await call("/api/posts", { cookie: "dopanima_session=eyJhbGciOiJub25lIn0.eyJzdWIiOjF9." })).status, 401))
  test("leitor não entra no painel → 403", async () => assert.equal((await call("/api/posts", { cookie: users.reader.cookie })).status, 403))
  test("login com e-mail inexistente e com senha errada dão a mesma mensagem", async () => {
    const a = await call("/api/auth/login", { method: "POST", body: { email: `${TAG}-ninguem@example.test`, password: "x" } })
    const b = await call("/api/auth/login", { method: "POST", body: { email: users.author.email, password: "senha-errada" } })
    assert.equal(a.status, 401)
    assert.equal(b.status, 401)
    assert.equal(a.json.error, b.json.error)
  })
  test("cookie de sessão é HttpOnly e SameSite=Lax", async () => {
    const r = await call("/api/auth/login", { method: "POST", body: { email: users.author.email, password: PASSWORD } })
    const c = r.setCookie.find((x) => x.startsWith("dopanima_session="))!
    assert.match(c, /HttpOnly/i)
    assert.match(c, /SameSite=Lax/i)
  })
})

describe("CSRF", () => {
  test("alteração com cookie vinda de outra origem → 403", async () => {
    const r = await call("/api/posts", { method: "POST", cookie: users.author.cookie, origin: EVIL, body: { title: `${TAG} csrf` } })
    assert.equal(r.status, 403)
  })
  test("CORS não libera origem desconhecida", async () => {
    const res = await fetch(base + "/api/public/home", { headers: { origin: EVIL } })
    assert.equal(res.headers.get("access-control-allow-origin"), null)
  })
})

describe("Autorização de posts (BOLA/IDOR e regras de status)", () => {
  test("colaborador não publica direto → 403", async () => {
    const r = await call("/api/posts", { method: "POST", cookie: users.contrib.cookie, body: { title: `${TAG} pub`, status: "published" } })
    assert.equal(r.status, 403)
  })
  test("colaborador não edita post publicado (nem o próprio) → 403", async () => {
    const p = await makePost(users.contrib.id, "published")
    const r = await call(`/api/posts/${p.id}`, { method: "PATCH", cookie: users.contrib.cookie, body: { content: "<p>alterado</p>" } })
    assert.equal(r.status, 403)
    const unpublish = await call(`/api/posts/${p.id}`, { method: "PATCH", cookie: users.contrib.cookie, body: { status: "draft" } })
    assert.equal(unpublish.status, 403)
  })
  test("colaborador edita o próprio rascunho → 200", async () => {
    const p = await makePost(users.contrib.id, "draft")
    const r = await call(`/api/posts/${p.id}`, { method: "PATCH", cookie: users.contrib.cookie, body: { subtitle: "ok" } })
    assert.equal(r.status, 200, r.text)
  })
  test("autor não lê nem edita rascunho de outro autor → 403", async () => {
    const p = await makePost(users.contrib.id, "draft")
    assert.equal((await call(`/api/posts/${p.id}`, { cookie: users.author.cookie })).status, 403)
    assert.equal((await call(`/api/posts/${p.id}`, { method: "PATCH", cookie: users.author.cookie, body: { title: "x" } })).status, 403)
  })
  test("autor não exclui post de outro autor → 403", async () => {
    const p = await makePost(users.contrib.id, "draft")
    assert.equal((await call(`/api/posts/${p.id}`, { method: "DELETE", cookie: users.author.cookie })).status, 403)
  })
  test("autor não consegue trocar o autor do post (authorId) para outra pessoa", async () => {
    const r = await call("/api/posts", { method: "POST", cookie: users.author.cookie, body: { title: `${TAG} dono`, authorId: users.contrib.id } })
    assert.equal(r.status, 201)
    ids.posts.push(r.json.id)
    assert.equal(r.json.author.id, users.author.id)
  })
  test("rascunho não aparece no site público → 404", async () => {
    const p = await makePost(users.author.id, "draft")
    assert.equal((await call(`/api/public/posts/${p.slug}`)).status, 404)
  })
})

describe("Escalada de privilégio", () => {
  test("não-admin não acessa /api/users → 403", async () => assert.equal((await call("/api/users", { cookie: users.author.cookie })).status, 403))
  test("campo role no próprio perfil é ignorado", async () => {
    await call("/api/auth/me", { method: "PATCH", cookie: users.contrib.cookie, body: { role: "super_admin", name: "Teste contrib" } })
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users.contrib.id } })).role, "contributor")
  })
  test("trocar e-mail sem a senha atual → 400", async () => {
    const r = await call("/api/auth/me", { method: "PATCH", cookie: users.author.cookie, body: { email: `${TAG}-novo@example.test` } })
    assert.equal(r.status, 400)
  })
  test("trocar e-mail com a senha atual → 200", async () => {
    const email = `${TAG}-author2@example.test`
    const r = await call("/api/auth/me", { method: "PATCH", cookie: users.author.cookie, body: { email, currentPassword: PASSWORD } })
    assert.equal(r.status, 200, r.text)
    users.author.email = email
  })
})

describe("Visão geral do painel respeita permissões", () => {
  test("colaborador não vê comentários pendentes nem rascunhos/revisões de outros", async () => {
    const other = await makePost(users.author.id, "review", `${TAG} REVISAO-SECRETA`)
    const pub = await makePost(users.author.id, "published")
    await prisma.comment.create({ data: { postId: pub.id, authorName: "x", authorEmail: "x@example.test", content: `${TAG} COMENTARIO-PENDENTE`, status: "pending" } })
    const r = await call("/api/stats/overview?days=7", { cookie: users.contrib.cookie })
    assert.equal(r.status, 200, r.text)
    assert.doesNotMatch(r.text, /REVISAO-SECRETA/)
    assert.doesNotMatch(r.text, /COMENTARIO-PENDENTE/)
    assert.equal(r.json.comments.pendingList.length, 0)
    assert.ok(other.id)
  })
})

describe("Upload", () => {
  test("colaborador (sem permissão de mídia) não envia arquivo → 403", async () => {
    const fd = new FormData()
    fd.append("files", new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }), "a.png")
    assert.equal((await call("/api/media", { method: "POST", cookie: users.contrib.cookie, raw: fd })).status, 403)
  })
  test("HTML disfarçado de PNG é recusado → 400", async () => {
    const fd = new FormData()
    fd.append("files", new Blob(["<script>alert(1)</script>"], { type: "image/png" }), "x.png")
    const r = await call("/api/media", { method: "POST", cookie: users.author.cookie, raw: fd })
    assert.equal(r.status, 400)
  })
  test("SVG não é aceito → 400", async () => {
    const fd = new FormData()
    fd.append("files", new Blob(["<svg onload=alert(1)></svg>"], { type: "image/svg+xml" }), "x.svg")
    assert.equal((await call("/api/media", { method: "POST", cookie: users.author.cookie, raw: fd })).status, 400)
  })
  test("path traversal em /uploads não sai da pasta", async () => {
    const res = await fetch(base + "/uploads/..%2f.env")
    assert.notEqual(res.status, 200)
  })
})

describe("Erros não vazam detalhes internos", () => {
  test("JSON inválido → 400 sem stack trace", async () => {
    const r = await call("/api/auth/login", { method: "POST", raw: "{ruim", headers: { "content-type": "application/json" } })
    assert.equal(r.status, 400)
    assert.doesNotMatch(r.text, /at \w+ \(|node_modules|\.ts:/)
  })
})

describe("Assistente de IA: acesso e limite diário", () => {
  const today = () => new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
  const usedToday = async (userId: number) =>
    Number((await prisma.$queryRaw<{ count: number }[]>`SELECT count FROM AiUsage WHERE userId = ${userId} AND day = ${today()}`)[0]?.count ?? 0)

  test("sem sessão → 401; leitor → 403", async () => {
    assert.equal((await call("/api/ai/status")).status, 401)
    assert.equal((await call("/api/ai/status", { cookie: users.reader.cookie })).status, 403)
  })
  test("status mostra o uso e o limite do dia", async () => {
    const r = await call("/api/ai/status", { cookie: users.contrib.cookie })
    assert.equal(r.status, 200)
    assert.equal(r.json.limit, env.AI_DAILY_LIMIT)
    assert.equal(r.json.used, 0)
  })
  test("no limite do dia, o pedido é recusado (429) sem chamar o Gemini", async () => {
    await prisma.$executeRaw`INSERT INTO AiUsage (userId, day, count) VALUES (${users.author.id}, ${today()}, ${env.AI_DAILY_LIMIT})`
    const r = await call("/api/ai/news", { method: "POST", cookie: users.author.cookie, body: { query: "duna" } })
    assert.equal(r.status, 429)
    assert.equal(await usedToday(users.author.id), env.AI_DAILY_LIMIT)
  })
  test("entrada grande demais é recusada (400) antes de gastar o limite", async () => {
    const r = await call("/api/ai/news", { method: "POST", cookie: users.contrib.cookie, body: { query: "x".repeat(500) } })
    assert.equal(r.status, 400)
    assert.equal(await usedToday(users.contrib.id), 0)
  })
  test("pedido que falha no Gemini não conta no limite", { skip: !!env.GEMINI_API_KEY && "chave configurada: o pedido daria certo" }, async () => {
    const r = await call("/api/ai/news", { method: "POST", cookie: users.contrib.cookie, body: { query: "duna" } })
    assert.equal(r.status, 503)
    assert.equal(await usedToday(users.contrib.id), 0)
  })
})

describe("Login: limite por conta não tranca o dono", () => {
  test("após 8 erros de um atacante, a vítima (dispositivo conhecido) ainda entra", async () => {
    const victim = users.contrib
    let last = 0
    for (let i = 0; i < 9; i++) last = (await call("/api/auth/login", { method: "POST", body: { email: victim.email, password: `errada-${i}` } })).status
    assert.equal(last, 429, "o atacante deveria ser barrado pelo limite da conta")
    const device = victim.cookie.split("; ").find((c) => c.startsWith("dopanima_device="))!
    const r = await call("/api/auth/login", { method: "POST", cookie: device, body: { email: victim.email, password: PASSWORD } })
    assert.equal(r.status, 200, r.text)
  })
})
