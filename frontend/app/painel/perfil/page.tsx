import type { Metadata } from "next"
import { ProfileView } from "@/components/dashboard/views/profile"

export const metadata: Metadata = { title: "Meu perfil" }

export default function Page() {
  return <ProfileView />
}
