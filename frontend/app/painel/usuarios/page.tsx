import type { Metadata } from "next"
import { UsersView } from "@/components/dashboard/views/users"

export const metadata: Metadata = { title: "Usuários" }

export default function Page() {
  return <UsersView />
}
