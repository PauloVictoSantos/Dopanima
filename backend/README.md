# Dopanima API

Backend do blog: Node + TypeScript + Express 5 + Prisma + MySQL 8.
O frontend (Next.js, pasta `../frontend`) só consome esta API.

## Rodando

```bash
cp .env.example .env       # ajuste DATABASE_URL e JWT_SECRET
npm install
npm run db:migrate         # cria o banco e as tabelas (migrations em prisma/migrations)
npm run db:seed            # conteúdo de exemplo (apaga tudo antes)
npm run dev                # http://localhost:3333
```

Login do seed: `lia@dopanima.com` / `dopanima123` (Super Admin). Todos os
usuários da equipe usam a mesma senha (`SEED_PASSWORD`).

No frontend: `NEXT_PUBLIC_API_URL=http://localhost:3333` em `.env.local`.

`DATABASE_URL` no formato `mysql://usuario:senha@localhost:3306/dopanima`. O
usuário precisa poder criar o banco (ou crie `dopanima` antes, com
`CHARACTER SET utf8mb4`). Em produção use `npm run db:deploy` para aplicar as
migrations sem prompts.

## Estrutura

```
src/
  app.ts, server.ts         montagem do Express e start (com o agendador)
  config/env.ts             variáveis de ambiente validadas
  lib/                      prisma, slug, sanitização de HTML, datas/fusos, permissões
  middlewares/              auth (JWT + permissões), upload (multer), erros
  jobs/scheduler.ts         publica posts agendados quando chega a hora
  modules/
    auth/                   login, /me
    posts/                  CRUD, status, agendamento, duplicar
    categories/ tags/       taxonomia
    media/                  biblioteca de mídia (upload, alt, substituir)
    users/                  CRUD, ações em massa, estatísticas
    seo/                    analisador, visão geral, redirects, robots, sitemap
    public/                 API do site público (sem login)
```

## Endpoints

Painel (header `Authorization: Bearer <token>`):

| Recurso | Rotas |
| --- | --- |
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/logout-all`, `GET/PATCH /api/auth/me` |
| Posts | `GET/POST /api/posts`, `GET/PUT/PATCH/DELETE /api/posts/:id`, `POST /api/posts/:id/duplicate` |
| Categorias | `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id`, `POST /api/categories/:id/move` |
| Tags | `GET/POST /api/tags`, `PUT/DELETE /api/tags/:id` |
| Mídia | `GET/POST /api/media` (multipart `files`), `GET /api/media/folders`, `PATCH/DELETE /api/media/:id`, `PUT /api/media/:id/file` |
| Usuários | `GET/POST /api/users`, `GET /api/users/stats`, `GET /api/users/authors`, `PATCH/DELETE /api/users/:id`, `POST /api/users/bulk`, `POST /api/users/:id/reset-password` |
| Comentários | `GET /api/comments`, `PATCH/DELETE /api/comments/:id`, `POST /api/comments/:id/reply`, `POST /api/comments/bulk`, `GET/PUT /api/comments/settings` |
| Estatísticas | `GET /api/stats/overview?days=7|30|90` |
| SEO | `POST /api/seo/analyze`, `GET /api/seo/overview`, `GET /api/seo/posts/:id`, `POST /api/seo/recalculate`, `GET/PUT /api/seo/settings`, `GET/PUT /api/seo/robots`, `GET/POST /api/seo/redirects`, `DELETE /api/seo/redirects/:id` |

Público: `GET /api/public/home`, `/api/public/posts?q=&type=&sub=&tag=`,
`/api/public/posts/:slug`, `POST /api/public/posts/:slug/view`,
`GET/POST /api/public/posts/:slug/comments`,
`/api/public/categories`, `/api/public/tags`, `/api/public/settings`,
`/api/public/redirects/resolve?path=`, `/sitemap.xml`, `/robots.txt`.

## Análise de SEO

`src/modules/seo/analyzer.ts` dá uma nota de 0 a 100 com checagens ponderadas:
palavra-chave (título, meta, URL, introdução, densidade, subtítulos, alt,
canibalização com outros posts), título e meta description (tamanho e
duplicidade), conteúdo (tamanho, parágrafos, subtítulos), legibilidade (índice
Flesch adaptado ao português, frases longas, conectivos), imagens, links
(internos, externos e quebrados) e indexação. A nota é recalculada a cada post
salvo e o editor recebe a análise ao vivo enquanto o texto é escrito.

Trocar o slug de um post publicado cria um redirecionamento 301 automaticamente.

## TMDB (filmes e séries)

Com `TMDB_TOKEN` no `.env` (o "Token de leitura da API" em
themoviedb.org/settings/api), a API passa a oferecer:

- **Editor**: buscar filme/série, vincular ao post (`tmdbId`/`tmdbType`), preencher
  título/sinopse e importar pôster ou cena para a biblioteca de mídia (vira imagem
  destacada, com alt e crédito).
- **Post no site**: ficha técnica (direção, elenco, duração, classificação), trailer,
  onde assistir no Brasil (JustWatch via TMDB) e "Se você gostou, assista também".
- **Home**: "O que assistir" (em alta, nos cinemas, mais bem avaliados, séries no ar).
  Títulos que já têm post no blog levam para o post.

A chave fica só no servidor. As respostas ficam em cache na memória (1 a 6 h). Sem a
chave, essas partes somem do site e o editor avisa que a integração está desligada.
Rotas: `GET /api/tmdb/status|search|:type/:id`, `POST /api/tmdb/:type/:id/import`,
`GET /api/public/tmdb/suggestions`, `GET /api/public/posts/:slug/tmdb`.

## Segurança

- **Sessão** em cookie `httpOnly` + `SameSite=Lax` (+ `Secure` em produção): o JavaScript
  da página não lê o token. Requisições que alteram dados com cookie só são aceitas
  vindas das origens em `FRONTEND_URL` (proteção CSRF). Clientes de API podem usar
  `Authorization: Bearer`.
- **Revogação**: trocar senha, função ou status (ou "sair de todos os dispositivos")
  invalida as sessões abertas na hora (`tokenVersion`).
- **Senhas**: bcrypt; mínimo de 8 caracteres e lista de senhas comuns. Senhas
  temporárias (convite/redefinição) obrigam a troca antes de usar o painel.
- **Login**: limite por IP e por conta; mesma resposta e mesmo tempo para e-mail
  inexistente e senha errada.
- **Uploads**: tipo conferido pela assinatura do arquivo (não pelo que o navegador
  diz), extensão gerada pelo servidor, SVG/HTML recusados, servidos com
  `Content-Security-Policy: sandbox` e `nosniff`.
- **Permissões por recurso**: autores só veem rascunhos próprios e só mexem nos
  próprios arquivos; o menu do painel esconde o que a função não pode usar.
- **HTML dos posts** sanitizado ao salvar e de novo ao servir; comentários são texto puro.
- **Comentários**: limite por IP, campo isca para robôs, anti-spam configurável,
  bloqueio de duplicados; IP guardado só como hash; e-mail nunca exposto no site.
- **Limites** gerais por IP em `/api`, e `TRUST_PROXY` para não confiar em
  `X-Forwarded-For` falsificado.
- Em produção: `NODE_ENV=production`, `JWT_SECRET` aleatório (32+ caracteres; a API
  recusa subir com segredo fraco), HTTPS, e API e site no mesmo domínio
  (ex.: `api.seusite.com` e `seusite.com`) para o cookie funcionar.

## Permissões

Definidas em `src/lib/constants.ts` (`ROLE_PERMISSIONS`): Super Admin, Editor,
Autor, Revisor, Colaborador e Leitor (sem acesso ao painel).
