import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="top" className="relative min-h-screen">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}
