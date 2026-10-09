import type { Metadata } from "next"
import { SavedPosts } from "@/components/saved-posts"

export const metadata: Metadata = { title: "Posts salvos", robots: { index: false, follow: false } }

export default function Page() {
  return <SavedPosts />
}
