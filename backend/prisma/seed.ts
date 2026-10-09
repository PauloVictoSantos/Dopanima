// Popula o banco com o conteúdo de exemplo que antes vivia mockado no frontend.
// Uso: npm run db:seed (apaga e recria tudo).

import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { slugify } from "../src/lib/slug"
import { recalculateAll } from "../src/modules/seo/seo.service"

const prisma = new PrismaClient()
const PASSWORD = process.env.SEED_PASSWORD || "dopanima123"
const DAY = 86400000
const NOW = Date.now()

// ---------- usuários ----------

const ROLE: Record<string, string> = { "Super Admin": "super_admin", Editor: "editor", Autor: "author", Revisor: "reviewer", Colaborador: "contributor", Leitor: "reader" }
const STATUS: Record<string, string> = { Ativo: "active", Pendente: "pending", Suspenso: "suspended" }
const COLORS = ["#B5179E", "#5A0F6E", "#7A2E8E", "#3B0A45", "#7A1F3D", "#26113A"]

// [nome, e-mail, função, status, dias desde o cadastro, minutos desde o último acesso (null = nunca), cidade]
const USERS: [string, string, string, string, number, number | null, string][] = [
  ["Lia Moreno", "lia@dopanima.com", "Super Admin", "Ativo", 940, 1, "Manaus, AM"],
  ["Caio Ventura", "caio@dopanima.com", "Editor", "Ativo", 919, 40, "São Paulo, SP"],
  ["Bia Tavares", "bia@dopanima.com", "Autor", "Ativo", 842, 120, "Rio de Janeiro, RJ"],
  ["Rafa Lins", "rafa.lins@email.com", "Revisor", "Ativo", 640, 8, "Manaus, AM"],
  ["Duda Campos", "duda@dopanima.com", "Colaborador", "Ativo", 413, 4320, "Recife, PE"],
  ["Júlia Prado", "julia.prado@email.com", "Leitor", "Ativo", 238, 24, "Belo Horizonte, MG"],
  ["Marcos Teles", "marcos.teles@email.com", "Leitor", "Ativo", 34, 60, "Fortaleza, CE"],
  ["Ana Reis", "ana.reis@email.com", "Leitor", "Ativo", 10, 1500, "Curitiba, PR"],
  ["Pedro Alves", "pedro.alves@email.com", "Leitor", "Ativo", 6, 1600, "Porto Alegre, RS"],
  ["promo_link99", "promo99@spam.net", "Leitor", "Suspenso", 3, 41, "Desconhecido"],
  ["Lu Martins", "lu.martins@email.com", "Leitor", "Ativo", 85, 2900, "Salvador, BA"],
  ["Nina Faria", "nina.faria@email.com", "Leitor", "Pendente", 2, null, "Lisboa, Portugal"],
]

// ---------- categorias ----------

// [id, nome, pai, descrição, cor]
const CATS: [number, string, number, string, string][] = [
  [1, "Filmes", 0, "Resenhas, listas e bastidores do cinema.", "#FF5A36"],
  [2, "Resenhas", 1, "Análises sem spoilers.", ""],
  [3, "Listas", 1, "Seleções da redação.", ""],
  [4, "Bastidores", 1, "Como os filmes são feitos.", ""],
  [5, "Livros", 0, "Leituras, trechos e listas.", "#F7E27A"],
  [6, "Resenhas", 5, "O que achamos de cada livro.", ""],
  [7, "Listas", 5, "Indicações por tema.", ""],
  [8, "Trechos comentados", 5, "Páginas lidas de perto.", ""],
  [9, "Séries", 0, "Temporadas, maratonas e finais.", "#8BE04E"],
  [10, "Resenhas", 9, "Temporada por temporada.", ""],
  [11, "Listas", 9, "Para maratonar.", ""],
  [17, "Bastidores", 9, "Sets, roteiros e equipes.", ""],
  [12, "Notícias", 0, "O que acontece na cultura pop.", "#C9A0E0"],
  [13, "Cinema", 12, "", ""],
  [14, "Literatura", 12, "", ""],
  [15, "Lançamentos", 12, "", ""],
  [16, "Bastidores", 12, "", ""],
]

const TAGS = ["resenha", "marvel", "série", "lista", "ficção científica", "lançamentos", "terror", "bastidores", "animação", "cinema nacional", "stephen king", "oscar", "dc", "infantil", "literatura", "festival"]

// ---------- mídia ----------

const G = "https://encrypted-tbn0.gstatic.com/images?q=tbn:"
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`

// [chave, arquivo, url, alt ("" = sem alt), pasta, largura, altura]
const MEDIA: [string, string, string, string, string, number, number][] = [
  ["av3", "avatar-fogo-e-cinzas.jpg", "https://m.media-amazon.com/images/S/pv-target-images/49d6d36196a739e9df418c577d69dbb3906eb482d6c95c565af52e11f193e6ac.jpg", "Pôster de Avatar: Fogo e Cinzas", "Capas", 1920, 1080],
  ["av2", "avatar-caminho-da-agua.jpg", G + "ANd9GcTpqc5pq4vxrZWENJbTz9W0A3R9BxwIZOB8S6dvqiaeDA&s=10", "Pôster de Avatar: O Caminho da Água", "Capas", 800, 1200],
  ["ult", "vingadores-ultimato.jpg", G + "ANd9GcSEu_F_GaXRlY4Lex0ns-u1qYTn3_1evdv-hwiYkcdiSA&s=10", "Pôster de Vingadores: Ultimato", "Capas", 1280, 720],
  ["moana", "moana.jpg", G + "ANd9GcT-iFHy_SFZ_8EK0UIGXpyouNH9ybN0JUeD_HFVkIu4hg&s=10", "", "Capas", 800, 1200],
  ["gato", "gato-de-botas-2.jpg", G + "ANd9GcSzjNI7NfkGxxWfwkgBvCn4uiyQi0QjZ604tyt81xtM3g&s=10", "Pôster de Gato de Botas 2: O Último Pedido", "Capas", 1920, 1080],
  ["just", "o-justiceiro.jpg", G + "ANd9GcRmbaOwebGqfgy1mvISI-o69F-KRmgyzu4X0V7BD4pK3Q&s=10", "Pôster da série O Justiceiro", "Capas", 1280, 720],
  ["aranha", "homem-aranha-novo-dia.jpg", G + "ANd9GcQvlmvWs9D3Fg257GT-ziO4OUXQ0TXJjypUL7wnFv9_fw&s=10", "Pôster de Homem-Aranha: Um Novo Dia", "Capas", 800, 1200],
  ["flash", "the-flash.jpg", G + "ANd9GcQk7SPapq3lhT3-r0iBNpNaE5quyTjdqejU8O2DQU5qsg&s=10", "", "Capas", 1920, 1080],
  ["duna", "duna.jpg", G + "ANd9GcSuqQAkZauUoB01AsyXS6-B-Pp7zpBQ2W7wjmQ3GN8OkA&s=10", "Pôster de Duna", "Capas", 1280, 720],
  ["aea", "ainda-estou-aqui.jpg", G + "ANd9GcR57Exd4Ags16MtMflGeND9A_Kit8qOTGyPHjrnt-Jl6w&s=10", "Cartaz de Ainda Estou Aqui", "Notícias", 800, 1200],
  ["dp", "deadpool-e-wolverine.jpg", G + "ANd9GcQ1xjP8ZSrSj593nHuKalqOfxm716ZeIe9mbG_3ZyLn4w&s=10", "Pôster de Deadpool & Wolverine", "Notícias", 1920, 1080],
  ["minnie", "minnie-the-lost-feline.jpg", G + "ANd9GcQHm3v2XWbpIKQETi6oPoWbIxGxYz5zNr-KenJlapptOg&s=10", "Capa do livro Minnie: The Lost Feline", "Capas", 1280, 720],
  ["it", "it-a-coisa.jpg", G + "ANd9GcQaPr5gRUwQjgEMEVMLGfQD7j1fVGz9llqvH6NT0Wkjxw&s=10", "Capa do livro It: A Coisa, de Stephen King", "Capas", 800, 1200],
  ["dd", "vingadores-doutor-destino.jpg", G + "ANd9GcS920fqVI2RWLkr4UXkvrVPoAH-KHgGbRUrUM_mx3JBxw&s=10", "Arte de Vingadores: Doutor Destino", "Capas", 1920, 1080],
]

const STOCK: Record<string, string[]> = {
  serie: ["1505686994434-e3cc5abf1330", "1574375927938-d5a98e8ffe85", "1586899028174-e7098604235b", "1616530940355-351fabd9524b", "1594909122845-11baa439b7bf", "1611162617474-5b21e879e113"],
  noticia: ["1504711434969-e33886168f5c", "1495020689067-958852a7765e", "1503428593586-e225b39bddfe", "1457369804613-52c61a468e7d", "1529156069898-49953e39b3ac", "1540575467063-178a50c2df87"],
}

// ---------- posts ----------

type Type = "filme" | "livro" | "serie" | "noticia"
// [slug, título, subtítulo, subcategoria, capa (chave de MEDIA), livro, autor do livro]
type Row = [string, string, string, string, string?, string?, string?]

const FILMS: Row[] = [
  ["avatar-o-caminho-da-agua", "Avatar: O Caminho da Água", "A volta a Pandora em escala oceânica", "Resenhas", "av2"],
  ["avatar-fogo-e-cinzas", "Avatar: Fogo e Cinzas", "O terceiro capítulo leva a saga para terras vulcânicas", "Resenhas", "av3"],
  ["vingadores-doutor-destino", "Vingadores: Doutor Destino", "Tudo o que já se sabe sobre o novo vilão", "Bastidores", "dd"],
  ["vingadores-ultimato", "Vingadores: Ultimato", "Revisitamos o fim da Saga do Infinito", "Resenhas", "ult"],
  ["moana", "Moana", "Por que a jornada pelo oceano ainda emociona", "Resenhas", "moana"],
  ["gato-de-botas-o-ultimo-pedido", "Gato de Botas 2: O Último Pedido", "Animação com cara de pintura e muito coração", "Resenhas", "gato"],
  ["homem-aranha-um-novo-dia", "Homem-Aranha: Um Novo Dia", "O que esperar da nova fase do herói", "Bastidores", "aranha"],
  ["duna", "Duna", "Areia, especiaria e um épico de ficção científica", "Resenhas", "duna"],
]
const BOOKS: Row[] = [
  ["it-a-coisa", "It: A Coisa", "O clássico do terror que atravessa gerações", "Resenhas", "it", "It: A Coisa", "Stephen King"],
  ["minnie-the-lost-feline", "Minnie: The Lost Feline", "Uma aventura felina para ler de uma vez", "Resenhas", "minnie", "Minnie: The Lost Feline", "Edição ilustrada"],
  ["trecho-mar-de-cobre", "O primeiro capítulo de Mar de Cobre", "Um trecho comentado linha a linha", "Trechos comentados", undefined, "Mar de Cobre", "Tomás Aragão"],
  ["jardim-de-ferrugem", "Jardim de Ferrugem", "Distopia botânica cheia de delicadeza", "Resenhas", undefined, "Jardim de Ferrugem", "Inês Valadares"],
  ["quando-os-mapas-mentem", "Quando os Mapas Mentem", "Aventura cartográfica com reviravoltas", "Resenhas", undefined, "Quando os Mapas Mentem", "Rui Calado"],
  ["5-fantasias-brasileiras", "5 fantasias brasileiras para começar", "Mitos, cidades e magia daqui", "Listas", undefined, "Fantasia Daqui", "Seleção Dopa"],
  ["trecho-o-inverno-de-clara", "A carta final de O Inverno de Clara", "Por que essas duas páginas emocionam", "Trechos comentados", undefined, "O Inverno de Clara", "Marta Seixas"],
  ["noite-no-arquivo", "Noite no Arquivo", "Mistério entre estantes e microfilmes", "Resenhas", undefined, "Noite no Arquivo", "Davi Lumen"],
]
const SERIES: Row[] = [
  ["o-justiceiro", "O Justiceiro", "Ação crua e um anti-herói sem meio-termo", "Resenhas", "just"],
  ["the-flash", "The Flash", "Nove temporadas correndo contra o tempo", "Resenhas", "flash"],
  ["bastidores-estacao-norte", "A cidade cenográfica de Estação Norte", "Um quarteirão inteiro construído do zero", "Bastidores"],
  ["familia-albuquerque-final", "Família Albuquerque e um final que divide", "A última temporada aposta no silêncio", "Resenhas"],
  ["o-detetive-de-papel", "O Detetive de Papel", "Animação noir feita quadro a quadro", "Resenhas"],
  ["5-aberturas-inesqueciveis", "5 aberturas de série que ninguém pula", "Música, colagem e muita personalidade", "Listas"],
  ["roteiristas-mare-alta", "A sala de roteiro de Maré Alta", "Como dez pessoas escreveram uma temporada", "Bastidores"],
  ["lua-de-concreto", "Lua de Concreto", "Ficção científica brasileira em formato de minissérie", "Resenhas"],
]
const NEWS: Row[] = [
  ["mostra-animacao-vila-aurora", "Festival de Vila Aurora anuncia mostra de animação independente", "Programação terá 30 curtas inéditos", "Cinema"],
  ["finalistas-pagina-viva", "Prêmio Página Viva divulga os finalistas de 2026", "Seis romances disputam a categoria principal", "Literatura"],
  ["ainda-estou-aqui-premios", "Ainda Estou Aqui segue em destaque após o Oscar", "O longa brasileiro venceu como Melhor Filme Internacional", "Cinema", "aea"],
  ["lanterna-vagas-roteiro", "Estúdio Lanterna abre vagas para roteiristas iniciantes", "Inscrições vão até o fim do mês", "Bastidores"],
  ["feira-porto-ceu-noturna", "Feira do Livro de Porto Céu terá programação noturna", "Leituras ao ar livre até meia-noite", "Literatura"],
  ["cineclube-itinerante", "Cineclube itinerante chega a 40 cidades do interior", "Sessões gratuitas em praças e escolas", "Cinema"],
  ["colecao-bolso-mare", "Editora Maré lança coleção de bolso", "Doze títulos com capas ilustradas", "Lançamentos"],
  ["deadpool-e-wolverine-recorde", "Deadpool & Wolverine e o recorde entre filmes para maiores", "A parceria mais desbocada da Marvel fez história na bilheteria", "Lançamentos", "dp"],
]

const ROOT: Record<Type, number> = { filme: 1, livro: 5, serie: 9, noticia: 12 }

const EXCERPTS: Record<string, string> = {
  Resenhas: "Contamos o que funciona, o que tropeça e para quem vale a pena, sem spoilers.",
  Listas: "Uma seleção feita pela redação, com indicações para todos os humores.",
  Bastidores: "Conversamos com a equipe para entender as decisões por trás das cenas mais comentadas.",
  "Trechos comentados": "Comentamos as escolhas de linguagem e o que o trecho antecipa sobre o livro.",
  news: "A redação reuniu as informações confirmadas até agora e o que muda para o público.",
}

const TAGS_BY_SLUG: Record<string, string[]> = {
  "avatar-fogo-e-cinzas": ["ficção científica", "resenha"], "it-a-coisa": ["terror", "stephen king", "resenha"], "o-justiceiro": ["marvel", "série", "resenha"],
  duna: ["ficção científica", "resenha"], "ainda-estou-aqui-premios": ["cinema nacional", "oscar"], "vingadores-ultimato": ["marvel", "resenha"],
  "deadpool-e-wolverine-recorde": ["lançamentos", "marvel"], moana: ["animação", "resenha"], "the-flash": ["série", "dc"],
  "minnie-the-lost-feline": ["animação", "infantil"], "avatar-o-caminho-da-agua": ["ficção científica", "resenha"],
  "vingadores-doutor-destino": ["marvel", "bastidores"], "homem-aranha-um-novo-dia": ["marvel", "bastidores", "lançamentos"],
  "gato-de-botas-o-ultimo-pedido": ["animação", "resenha"], "5-fantasias-brasileiras": ["lista", "literatura"], "5-aberturas-inesqueciveis": ["lista", "série"],
  "mostra-animacao-vila-aurora": ["animação", "festival"], "finalistas-pagina-viva": ["literatura"], "feira-porto-ceu-noturna": ["literatura", "festival"],
}

const VIEWS: Record<string, number> = {
  "avatar-fogo-e-cinzas": 18420, "it-a-coisa": 15210, "o-justiceiro": 12988, duna: 11340, "ainda-estou-aqui-premios": 9875, "vingadores-ultimato": 9012,
  "deadpool-e-wolverine-recorde": 4630, moana: 7420, "the-flash": 6210, "minnie-the-lost-feline": 3980, "avatar-o-caminho-da-agua": 22140,
}

function body(type: Type, title: string, bookAuthor: string | undefined, link: { slug: string; title: string }, long: boolean) {
  const p = (s: string) => `<p>${s}</p>`
  const more = long
    ? p("Além disso, vale prestar atenção nos detalhes que passam rápido na primeira vez. Há escolhas de cenário, figurino e trilha que só se revelam numa segunda visita, e é aí que a obra mostra o quanto foi pensada. Por isso, recomendamos voltar a ela com calma, de preferência com alguém para comentar depois.") +
      p("Por fim, um aviso para quem chega agora: não é preciso conhecer tudo o que veio antes para aproveitar. O texto se sustenta sozinho e convida o leitor a descobrir o restante no próprio ritmo.")
    : ""
  const outro = `${p(`Leia também: <a href="/post/${link.slug}">${link.title}</a>.`)}`
  if (type === "serie")
    return [
      p(`${title} chega ao streaming com uma proposta clara: episódios enxutos, personagens com camadas e um gancho no fim de cada capítulo que torna difícil parar.`),
      "<h2>O que funciona</h2>",
      p("A direção alterna entre planos longos e montagem acelerada, e isso dá à série um ritmo próprio. O elenco de apoio rouba a cena em mais de um episódio."),
      p("O roteiro nem sempre amarra todas as pontas, e um ou outro arco secundário parece ter ficado pela metade. Ainda assim, a temporada mantém o interesse até o fim."),
      "<blockquote>Algumas histórias não pedem pressa. Pedem companhia.</blockquote>",
      "<h2>Vale a maratona?</h2>",
      p("Para quem gosta de maratonar com calma, vale reservar o fim de semana. E, se possível, assistir com alguém para comentar cada reviravolta."),
      more, outro,
    ].join("")
  if (type === "livro")
    return [
      p(`${title} é daqueles livros que pedem um lugar confortável e algumas horas sem interrupção. A escrita de ${bookAuthor} é precisa, sem pressa e cheia de imagens.`),
      "<h2>A leitura</h2>",
      p("Os capítulos curtos ajudam a manter o ritmo, enquanto as personagens ganham profundidade aos poucos. Há trechos que dá vontade de sublinhar e reler em voz alta."),
      p("O miolo da narrativa desacelera um pouco, e alguns leitores podem sentir falta de mais ação. Mas o desfecho recompensa a paciência."),
      "<blockquote>Algumas histórias não pedem pressa. Pedem companhia.</blockquote>",
      "<h2>Para quem é</h2>",
      p("Recomendamos para quem gosta de histórias que ficam ecoando depois da última página. Ótimo também para clubes de leitura: rende conversa."),
      more, outro,
    ].join("")
  if (type === "noticia")
    return [
      p(`${title}. A informação foi confirmada nesta semana e movimentou as conversas entre leitores e cinéfilos que acompanham o Dopanima.`),
      "<h2>O que se sabe</h2>",
      p("Segundo os organizadores, a ideia é aproximar o público de quem produz cultura, com encontros abertos, sessões comentadas e espaço para novos nomes."),
      p("Ainda há detalhes a serem divulgados, como horários e a lista completa de convidados. Vamos atualizar este post conforme as novidades chegarem."),
      p("Enquanto isso, a redação preparou uma seleção de posts relacionados para quem quer se aprofundar no assunto."),
      more, outro,
    ].join("")
  return [
    p(`${title} chegou à nossa mesa cercado de expectativa, e a primeira impressão é de cuidado: cada escolha parece pensada para quem gosta de prestar atenção nos detalhes.`),
    "<h2>O que funciona</h2>",
    p("O ritmo é paciente. Em vez de correr para a próxima reviravolta, a obra deixa os personagens respirarem, e é nesses intervalos que ela encontra sua força."),
    p("Nem tudo funciona com a mesma precisão. Há momentos em que a ambição pesa mais que a execução, mas os tropeços são de quem arrisca, e isso conta a favor."),
    "<blockquote>Algumas histórias não pedem pressa. Pedem companhia.</blockquote>",
    "<h2>Vale o ingresso?</h2>",
    p("No fim, fica a sensação de ter passado um tempo bem gasto. É o tipo de experiência que pede conversa depois, de preferência com alguém que também se deixou levar."),
    more, outro,
  ].join("")
}

async function main() {
  console.log("Limpando o banco...")
  await prisma.$transaction([
    prisma.postViewDaily.deleteMany(), prisma.comment.deleteMany({ where: { parentId: { not: null } } }), prisma.comment.deleteMany(),
    prisma.postTag.deleteMany(), prisma.post.deleteMany(), prisma.tag.deleteMany(), prisma.media.deleteMany(),
    prisma.category.deleteMany({ where: { parentId: { not: null } } }), prisma.category.deleteMany(), prisma.redirect.deleteMany(), prisma.setting.deleteMany(), prisma.user.deleteMany(),
  ])

  console.log("Usuários...")
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const users: Record<string, number> = {}
  for (const [i, [name, email, role, status, joinedDays, lastMin, city]] of USERS.entries()) {
    const u = await prisma.user.create({
      data: {
        name, email, passwordHash, city,
        role: ROLE[role], status: STATUS[status], color: COLORS[i % COLORS.length],
        bio: i === 0 ? "Editora-chefe do Dopanima. Assiste a tudo com legenda e lê três livros ao mesmo tempo." : "",
        createdAt: new Date(NOW - joinedDays * DAY),
        lastLoginAt: lastMin == null ? null : new Date(NOW - lastMin * 60000),
      },
    })
    users[name] = u.id
  }
  const AUTHORS = [users["Lia Moreno"], users["Caio Ventura"], users["Bia Tavares"]]

  console.log("Categorias e tags...")
  const position: Record<number, number> = {}
  for (const [id, name, parent, description, color] of CATS) {
    position[parent] = (position[parent] ?? -1) + 1
    await prisma.category.create({ data: { id, name, slug: slugify(name), parentId: parent || null, description, color, position: position[parent] } })
  }
  const subId = (type: Type, name: string) => CATS.find(([, n, parent]) => parent === ROOT[type] && n === name)?.[0] ?? null
  for (const name of TAGS) await prisma.tag.create({ data: { name, slug: slugify(name) } })

  console.log("Mídia...")
  const media: Record<string, number> = {}
  for (const [i, [key, name, url, alt, folder, width, height]] of MEDIA.entries()) {
    const m = await prisma.media.create({
      data: { name, externalUrl: url, mimeType: "image/jpeg", type: "image", size: (180 + ((i * 53) % 420)) * 1024, width, height, alt, folder, uploaderId: AUTHORS[i % 3], createdAt: new Date(NOW - (10 + i) * DAY) },
    })
    media[key] = m.id
  }
  for (const [type, ids] of Object.entries(STOCK))
    for (const [i, id] of ids.entries()) {
      const m = await prisma.media.create({
        data: { name: `banco-${type}-${i + 1}.jpg`, externalUrl: unsplash(id), mimeType: "image/jpeg", type: "image", size: 240 * 1024, width: 1200, height: 800, alt: `Imagem ilustrativa de ${type === "serie" ? "série" : "notícia"}`, folder: "Geral", uploaderId: AUTHORS[i % 3] },
      })
      media[`${type}${i}`] = m.id
    }
  await prisma.media.createMany({
    data: [
      { name: "teaser-duna-parte-3.mp4", externalUrl: "https://dopanima.com/midia/teaser-duna-parte-3.mp4", mimeType: "video/mp4", type: "video", size: 25795788, width: 1920, height: 1080, folder: "Geral", uploaderId: AUTHORS[0] },
      { name: "dopacast-ep-12.mp3", externalUrl: "https://dopanima.com/midia/dopacast-ep-12.mp3", mimeType: "audio/mpeg", type: "audio", size: 40055603, folder: "Geral", uploaderId: AUTHORS[1] },
      { name: "kit-imprensa-festival.pdf", externalUrl: "https://dopanima.com/midia/kit-imprensa-festival.pdf", mimeType: "application/pdf", type: "document", size: 2202009, folder: "Notícias", uploaderId: AUTHORS[2] },
    ],
  })

  console.log("Posts...")
  const tagIds = Object.fromEntries((await prisma.tag.findMany()).map((t) => [t.name, t.id]))
  const all: { row: Row; type: Type }[] = []
  for (let i = 0; i < 8; i++) all.push({ row: FILMS[i], type: "filme" }, { row: BOOKS[i], type: "livro" }, { row: SERIES[i], type: "serie" }, { row: NEWS[i], type: "noticia" })
  const featured = ["avatar-fogo-e-cinzas", "it-a-coisa", "o-justiceiro", "duna", "ainda-estou-aqui-premios"]

  for (const [k, { row, type }] of all.entries()) {
    const [slug, title, subtitle, sub, coverKey, book, bookAuthor] = row
    const i = Math.floor(k / 4)
    const j = k % 4
    const publishedAt = new Date(2026, 9, 4 - Math.floor(k * 0.8), 9 + (k % 10), 0)
    const link = all[(k + 5) % all.length].row
    const stock = type === "serie" || type === "noticia" ? media[`${type}${i % 6}`] : undefined
    const excerpt = `${subtitle}. ${type === "noticia" ? EXCERPTS.news : EXCERPTS[sub]}`
    // Variação proposital para o painel de SEO ter posts bons, médios e ruins.
    const keyword = k % 3 === 2 ? "" : title.split(":")[0].toLowerCase()
    const tags = TAGS_BY_SLUG[slug] ?? (sub === "Resenhas" ? ["resenha"] : sub === "Listas" ? ["lista"] : sub === "Bastidores" ? ["bastidores"] : [])
    await prisma.post.create({
      data: {
        slug, title, subtitle, excerpt,
        content: body(type, title, bookAuthor, { slug: link[0], title: link[1] }, k % 2 === 0),
        seoReport: "[]",
        status: "published",
        featured: featured.includes(slug),
        book: book ?? "", bookAuthor: bookAuthor ?? "",
        categoryId: ROOT[type],
        subcategoryId: subId(type, sub),
        authorId: AUTHORS[(i + j) % 3],
        coverId: coverKey ? media[coverKey] : stock ?? null,
        publishedAt,
        createdAt: new Date(publishedAt.getTime() - 2 * DAY),
        focusKeyword: keyword,
        metaDescription: k % 4 === 0 ? `${subtitle}. ${EXCERPTS[sub] ?? EXCERPTS.news} Leia a análise completa no Dopanima.`.slice(0, 160) : "",
        views: VIEWS[slug] ?? 800 + ((k * 977) % 5200),
        engagement: +(4 + ((k * 37) % 70) / 10).toFixed(1),
        tags: { create: tags.map((t) => ({ tagId: tagIds[t] })) },
      },
    })
  }

  // Posts fora do ar: agendados, em revisão e rascunho.
  const at = (days: number, h: number, m = 0) => {
    const d = new Date(NOW + days * DAY)
    d.setUTCHours(h + 4, m, 0, 0) // horário de Manaus (UTC-4)
    return d
  }
  const extras = [
    { slug: "avatar-fogo-e-cinzas-os-bastidores", title: "Avatar: Fogo e Cinzas — os bastidores", status: "scheduled", scheduledAt: at(3, 19, 30), cat: 1, sub: 4, cover: "av3", author: 0, tags: ["ficção científica", "bastidores"] },
    { slug: "5-livros-de-terror-para-outubro", title: "5 livros de terror para outubro", status: "scheduled", scheduledAt: at(5, 9), cat: 5, sub: 7, cover: "it", author: 1, tags: ["terror", "stephen king", "lista"] },
    { slug: "homem-aranha-um-novo-dia-ganha-trailer", title: "Homem-Aranha: Um Novo Dia ganha trailer", status: "scheduled", scheduledAt: at(8, 18), cat: 12, sub: 15, cover: "aranha", author: 2, tags: ["marvel", "lançamentos"] },
    { slug: "vingadores-doutor-destino-o-que-sabemos", title: "Vingadores: Doutor Destino — o que sabemos", status: "review", cat: 1, sub: 4, cover: "dd", author: 2, tags: ["marvel"] },
    { slug: "gato-de-botas-2-por-que-a-animacao-funciona", title: "Gato de Botas 2: por que a animação funciona", status: "draft", cat: 1, sub: 2, cover: undefined, author: 1, tags: ["animação"] },
  ]
  for (const e of extras)
    await prisma.post.create({
      data: {
        slug: e.slug, title: e.title, status: e.status, scheduledAt: e.scheduledAt ?? null,
        excerpt: e.status === "draft" ? "" : `${e.title}: tudo o que você precisa saber, sem spoilers.`,
        content: e.status === "draft" ? "<p>Rascunho: começar pela técnica de animação inspirada em pintura.</p>" : body("filme", e.title, undefined, { slug: "duna", title: "Duna" }, false),
        seoReport: "[]",
        categoryId: e.cat, subcategoryId: e.sub, coverId: e.cover ? media[e.cover] : null, authorId: AUTHORS[e.author],
        focusKeyword: e.status === "scheduled" ? e.title.split(/[:—]/)[0].trim().toLowerCase() : "",
        tags: { create: e.tags.map((t) => ({ tagId: tagIds[t] })) },
      },
    })

  console.log("Comentários...")
  // [nome, e-mail, slug do post, minutos atrás, texto, status]
  const COMMENTS: [string, string, string, number, string, string][] = [
    ["Rafa Lins", "rafa.lins@email.com", "duna", 8, "A parte do som no deserto ficou incrível na resenha, deu vontade de rever no cinema.", "pending"],
    ["Júlia Prado", "julia.prado@email.com", "it-a-coisa", 24, "Li na adolescência e até hoje lembro do capítulo do esgoto. Ótima análise!", "pending"],
    ["promo_link99", "promo99@spam.net", "o-justiceiro", 41, "Assista grátis todas as temporadas clicando no link do meu perfil!!!", "spam"],
    ["Marcos Teles", "marcos.teles@email.com", "avatar-fogo-e-cinzas", 60, "Será que vai ter versão em 3D nas salas menores também?", "pending"],
    ["Ana Reis", "ana.reis@email.com", "moana", 1500, "Minha filha sabe todas as músicas de cor. Amei a lista!", "approved"],
    ["Pedro Alves", "pedro.alves@email.com", "duna", 1600, "A trilha sonora merecia um post só pra ela.", "approved"],
    ["Lu Martins", "lu.martins@email.com", "it-a-coisa", 2900, "Prefiro o livro ao filme, sem dúvida.", "approved"],
  ]
  const postIds = Object.fromEntries((await prisma.post.findMany({ select: { id: true, slug: true } })).map((p) => [p.slug, p.id]))
  for (const [authorName, authorEmail, slug, min, content, status] of COMMENTS)
    await prisma.comment.create({ data: { postId: postIds[slug], authorName, authorEmail, content, status, createdAt: new Date(NOW - min * 60000) } })
  for (const id of new Set(Object.values(postIds)))
    await prisma.post.update({ where: { id }, data: { commentsCount: await prisma.comment.count({ where: { postId: id, status: "approved" } }) } })

  console.log("Redirecionamentos...")
  await prisma.redirect.createMany({
    data: [
      { from: "/filmes/duna-resenha", to: "/post/duna", hits: 312 },
      { from: "/noticias/oscar-2025", to: "/post/ainda-estou-aqui-premios", hits: 128 },
    ],
  })

  console.log("Calculando notas de SEO...")
  const { updated } = await recalculateAll()
  console.log(`Pronto: ${updated} posts analisados. Login: lia@dopanima.com / ${PASSWORD}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
