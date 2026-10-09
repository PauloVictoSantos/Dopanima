import type { Metadata } from "next"
import { CommentsView } from "@/components/dashboard/views/comments"

export const metadata: Metadata = { title: "Comentários" }

export default function Page() {
  return <CommentsView />
}
