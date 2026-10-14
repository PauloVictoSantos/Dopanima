import type { Metadata } from "next"
import { Lilita_One, Poppins } from "next/font/google"
import { MotionConfig } from "motion/react"
import { DialogHost } from "@/components/confirm-dialog"
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
            {/* As mensagens são desenhadas por lib/toast.tsx (componente Alert); o sonner só posiciona. */}
            <Toaster theme="dark" position="bottom-center" toastOptions={{ unstyled: true }} />
            {/* Perguntas (confirmar, digitar um link...) em AlertDialog, no lugar de window.confirm/prompt. */}
            <DialogHost />
          </SiteProvider>
        </MotionConfig>
      </body>
    </html>
  )
}
