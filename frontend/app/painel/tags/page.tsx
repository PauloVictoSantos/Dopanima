import type { Metadata } from "next"
import { TagsView } from "@/components/dashboard/views/tags"

export const metadata: Metadata = { title: "Tags" }

export default function Page() {
  return <TagsView />
}
