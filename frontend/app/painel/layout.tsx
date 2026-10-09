import type { Metadata } from "next"
import { DashboardProvider } from "@/components/dashboard/dashboard-provider"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel | Dopanima" },
  robots: { index: false, follow: false },
}

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  )
}
