import type { Metadata } from "next"
import { CategoriesView } from "@/components/dashboard/views/categories"

export const metadata: Metadata = { title: "Categorias" }

export default function Page() {
  return <CategoriesView />
}
