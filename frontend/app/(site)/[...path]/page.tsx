import { notFound, permanentRedirect } from "next/navigation"
import { resolveRedirect } from "@/lib/public-api"

// Qualquer URL sem página própria: aplica os redirecionamentos 301 cadastrados
// no painel de SEO; se não houver, 404.
export default async function CatchAll({ params }: PageProps<"/[...path]">) {
  const to = await resolveRedirect("/" + (await params).path.join("/"))
  if (to) permanentRedirect(to)
  notFound()
}
