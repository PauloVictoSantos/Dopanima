import type { Metadata } from "next"
import { PostsView } from "@/components/dashboard/views/posts"

export const metadata: Metadata = { title: "Posts" }

export default function Page() {
  return <PostsView />
}
