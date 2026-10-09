import type { Metadata } from "next"
import { AgendaView } from "@/components/dashboard/views/agenda"

export const metadata: Metadata = { title: "Agendamento" }

export default function Page() {
  return <AgendaView />
}
