import type { Metadata } from "next"
import { SeoView } from "@/components/dashboard/views/seo"

export const metadata: Metadata = { title: "SEO" }

export default function Page() {
  return <SeoView />
}
