import type { Metadata } from "next"
import { MediaView } from "@/components/dashboard/views/media"

export const metadata: Metadata = { title: "Biblioteca de mídia" }

export default function Page() {
  return <MediaView />
}
