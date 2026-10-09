import type { Metadata } from "next"
import { PermissionsView } from "@/components/dashboard/views/permissions"

export const metadata: Metadata = { title: "Permissões" }

export default function Page() {
  return <PermissionsView />
}
