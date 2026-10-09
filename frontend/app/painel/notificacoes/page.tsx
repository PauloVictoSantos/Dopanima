import type { Metadata } from "next"
import { NotificationsView } from "@/components/dashboard/views/notifications"

export const metadata: Metadata = { title: "Notificações" }

export default function Page() {
  return <NotificationsView />
}
