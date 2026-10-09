import type { Metadata } from "next"
import { AnalyticsView } from "@/components/dashboard/views/analytics"

export const metadata: Metadata = { title: "Analytics" }

export default function Page() {
  return <AnalyticsView />
}
