import type { Metadata } from "next"
import { EditorView } from "@/components/dashboard/views/editor"

export const metadata: Metadata = { title: "Novo post" }

export default function Page() {
  return <EditorView />
}
