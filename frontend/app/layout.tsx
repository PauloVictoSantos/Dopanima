import type { Metadata } from "next"
import { Lilita_One, Poppins } from "next/font/google"
import { MotionConfig } from "motion/react"
import { Toaster } from "@/components/ui/sonner"
import { SiteProvider } from "@/components/site-provider"
import "./globals.css"

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const lilita = Lilita_One({ variable: "--font-lilita", subsets: ["latin"], weight: "400" })

export const metadata: Metadata = {
  title: { default: "Dopanima", template: "%s | Dopanima" },
  description: "Filmes, livros e notícias em um só lugar.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} ${lilita.variable} dark`} data-scroll-behavior="smooth">
      <body className="min-h-screen overflow-x-hidden">
        <MotionConfig reducedMotion="user">
          <SiteProvider>
            {children}
            <Toaster
              theme="dark"
              position="bottom-center"
              toastOptions={{ classNames: { toast: "!bg-dp-panel !border-dp-yellow/40 !text-white !font-sans !rounded-[14px]" } }}
            />
          </SiteProvider>
        </MotionConfig>
      </body>
    </html>
  )
}
