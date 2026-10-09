import type { Metadata } from "next"
import { EditorView } from "@/components/dashboard/views/editor"

export const metadata: Metadata = { title: "Editar post" }

export default async function Page({ params }: PageProps<"/painel/posts/[id]">) {
  return <EditorView id={Number((await params).id)} />
}
