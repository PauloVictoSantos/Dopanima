"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { errorMessage } from "@/lib/api"
import { safeNext, siteLogin, siteRegister } from "@/lib/site-session"
import { cn } from "@/lib/utils"

const fieldCls = "h-12 w-full rounded-xl border border-white/20 bg-white/5 px-4 text-[15px] text-white outline-none transition-colors placeholder:text-[#9C8AA6] focus:border-dp-yellow"
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

/** Login e cadastro de leitores do site (para comentar e salvar posts). */
export function ReaderAuth({ next, initialMode = "login" }: { next?: string; initialMode?: "login" | "register" }) {
  const router = useRouter()
  const [mode, setMode] = useState(initialMode)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [show, setShow] = useState(false)
  const [website, setWebsite] = useState("")
  const [err, setErr] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (mode === "register" && name.trim().length < 2) return setErr("Digite seu nome.")
    if (!isEmail(email)) return setErr("Digite um e-mail válido.")
    if (mode === "register" && pw.length < 8) return setErr("A senha precisa ter ao menos 8 caracteres.")
    if (!pw) return setErr("Digite sua senha.")
    setLoading(true)
    setErr("")
    try {
      const user =
        mode === "register"
          ? await siteRegister({ name: name.trim(), email: email.trim(), password: pw, website })
          : await siteLogin(email.trim(), pw, true)
      toast.success(mode === "register" ? `Conta criada! Bem-vindo(a), ${user.name.split(" ")[0]}.` : `Olá, ${user.name.split(" ")[0]}!`)
      router.replace(safeNext(next))
      router.refresh()
    } catch (e) {
      setErr(errorMessage(e))
      setLoading(false)
    }
  }

  const switchMode = (m: "login" | "register") => {
    setMode(m)
    setErr("")
  }

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 rounded-3xl border border-white/14 bg-white/4 p-[clamp(20px,4vw,36px)]">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[28px] font-bold">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="m-0 text-sm leading-normal text-dp-muted">
          {mode === "login" ? "Entre para comentar e salvar seus posts favoritos." : "É grátis. Com uma conta você comenta e salva posts para ler depois."}
        </p>
      </div>

      <div role="tablist" aria-label="Entrar ou criar conta" className="grid grid-cols-2 rounded-full border border-white/18 p-1">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={cn("h-9 cursor-pointer rounded-full text-xs font-semibold", mode === m ? "bg-dp-yellow text-dp-bg" : "text-white")}
          >
            {m === "login" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        {mode === "register" && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" aria-label="Seu nome" autoComplete="name" maxLength={80} className={fieldCls} />
        )}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail" aria-label="Seu e-mail" autoComplete="email" maxLength={191} className={fieldCls} />
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={mode === "register" ? "Crie uma senha (8+ caracteres)" : "Sua senha"}
            aria-label="Senha"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            maxLength={200}
            className={fieldCls + " pr-12"}
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Esconder senha" : "Mostrar senha"} className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 cursor-pointer place-items-center text-dp-muted">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {/* Isca para robôs: escondida de pessoas e de leitores de tela. */}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        {err && <span role="alert" className="text-[13px] text-dp-yellow">{err}</span>}
        <button
          type="submit"
          disabled={loading}
          className="flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-full bg-dp-orange text-[13px] font-semibold tracking-[0.1em] text-white uppercase transition-transform hover:scale-[1.01] active:scale-[0.98] disabled:opacity-75"
        >
          {loading && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <p className="m-0 text-center text-xs text-dp-muted">
        Faz parte da equipe do blog? <Link href="/login" className="text-dp-yellow">Acesse o painel</Link>
      </p>
    </div>
  )
}
