import type { Metadata } from "next"
import { ReaderAuth } from "@/components/auth/reader-auth"

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } }

export default async function Page({ searchParams }: PageProps<"/entrar">) {
  const sp = await searchParams
  const next = typeof sp.next === "string" ? sp.next : undefined
  return (
    <main className="flex min-h-screen items-center px-[clamp(16px,5vw,64px)] pt-28 pb-16">
      <ReaderAuth next={next} initialMode={sp.criar === "1" ? "register" : "login"} />
    </main>
  )
}
