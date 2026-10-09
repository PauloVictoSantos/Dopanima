"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { RelatedCard } from "@/components/cards"
import { api } from "@/lib/api"
import type { Post } from "@/lib/posts"
import { useSiteUser } from "@/lib/site-session"
import { useSite } from "@/components/site-provider"

/** Lista dos posts que o leitor salvou (guardados na conta, no servidor). */
export function SavedPosts() {
  const user = useSiteUser()
  const { isSaved } = useSite()
  const [posts, setPosts] = useState<Post[] | null>(null)

  useEffect(() => {
    if (!user) return
    api.get<Post[]>("/api/public/me/saved").then(setPosts).catch(() => setPosts([]))
  }, [user])

  const visible = posts?.filter((p) => isSaved(p.slug)) ?? []

  return (
    <main className="mx-auto min-h-screen max-w-[1280px] px-[clamp(16px,5vw,64px)] pt-32 pb-16">
      <h1 className="mb-6 text-[clamp(28px,4vw,40px)] font-bold">Posts salvos</h1>
      {user === false ? (
        <p className="text-sm text-dp-muted">
          <Link href="/entrar?next=/salvos" className="text-dp-yellow">Entre na sua conta</Link> para ver os posts que você salvou.
        </p>
      ) : posts === null ? (
        <p className="text-sm text-dp-muted">Carregando...</p>
      ) : visible.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {visible.map((p) => <RelatedCard key={p.slug} post={p} />)}
        </div>
      ) : (
        <p className="text-sm text-dp-muted">
          Você ainda não salvou nenhum post. Use o ícone de marcador nos posts para guardar e ler depois. <Link href="/" className="text-dp-yellow">Ver posts</Link>
        </p>
      )}
    </main>
  )
}
