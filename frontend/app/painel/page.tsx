import type { Metadata } from "next"
import { OverviewView } from "@/components/dashboard/views/overview"

export const metadata: Metadata = { title: "Visão geral" }

export default function Page() {
  return <OverviewView />
}
