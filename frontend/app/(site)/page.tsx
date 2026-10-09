import HomePage from "@/components/home/home-page"
import { getHome } from "@/lib/public-api"

// Conteúdo vem da API a cada requisição (publicar no painel aparece na hora).
export const dynamic = "force-dynamic"

export default async function Page() {
  return <HomePage data={await getHome()} />
}
