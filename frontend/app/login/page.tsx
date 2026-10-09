import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Entrar no painel",
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return <LoginForm />
}
