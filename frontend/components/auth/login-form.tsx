"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Check, CircleAlert, Eye, EyeOff } from "lucide-react"
import { Logo } from "@/components/brand"
import { isEmail } from "@/lib/dashboard"
import { ApiError, errorMessage } from "@/lib/api"
import { signIn } from "@/lib/session"
import { cn } from "@/lib/utils"

// Conta criada pelo seed do backend (npm run db:seed). Só aparece fora de produção.
const DEMO_ACCOUNT = process.env.NODE_ENV === "production" ? null : { email: "lia@dopanima.com", password: "dopanima123" }

type Field = "" | "email" | "pw" | "both"

const fieldCls = (bad: boolean) =>
  cn(
    "h-12 w-full rounded-xl border bg-white/5 px-4 text-[15px] text-white outline-none transition-colors placeholder:text-[#9C8AA6] focus:border-dp-yellow",
    bad ? "border-[#FF8A73]" : "border-white/20"
  )
const submitCls =
  "flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-full bg-dp-orange text-[13px] font-semibold tracking-[0.1em] text-white uppercase transition-[background-color,transform] hover:bg-dp-orange-hi active:scale-[0.98] disabled:cursor-default disabled:opacity-75"

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "forgot">("login")
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState("")
  const [field, setField] = useState<Field>("")
  const [loading, setLoading] = useState(false)
  const [tries, setTries] = useState(0)
  const [sent, setSent] = useState(false)

  const bad = (f: "email" | "pw") => field === f || field === "both"
  const fail = (message: string, f: Field) => {
    setErr(message)
    setField(f)
  }
  const clearErr = () => {
    setErr("")
    setField("")
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!isEmail(email)) return fail("Digite um e-mail válido.", "email")
    if (!pw) return fail("Digite sua senha.", "pw")
    setLoading(true)
    clearErr()
    try {
      await signIn(email.trim(), pw, remember)
      router.push("/painel")
    } catch (e) {
      setLoading(false)
      if (!(e instanceof ApiError) || e.status !== 401) return fail(errorMessage(e), "")
      const n = tries + 1
      setTries(n)
      fail(n >= 3 ? `E-mail ou senha incorretos. Já foram ${n} tentativas — que tal recuperar a senha?` : "E-mail ou senha incorretos.", "both")
    }
  }

  const sendReset = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEmail(email)) return fail("Digite um e-mail válido.", "email")
    clearErr()
    setSent(true)
  }

  const switchMode = (m: "login" | "forgot") => {
    setMode(m)
    clearErr()
    setSent(false)
  }

  return (
    <div className="flex min-h-screen bg-dp-bg text-white">
      <aside
        aria-hidden
        className="relative hidden min-h-screen flex-[1_1_55%] overflow-hidden min-[900px]:block"
        style={{ background: `url("https://m.media-amazon.com/images/S/pv-target-images/49d6d36196a739e9df418c577d69dbb3906eb482d6c95c565af52e11f193e6ac.jpg") center/cover no-repeat, #3B0A45` }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.15)_55%,rgba(0,0,0,.35)_100%)]" />
        <div className="absolute inset-x-14 bottom-14 flex flex-col gap-4">
          <Logo size={64} className="origin-bottom-left [-webkit-text-stroke-width:5px]" />
          <p className="m-0 mt-3 max-w-[420px] text-xl leading-[1.35] font-semibold">Filmes, livros e notícias em um só lugar.</p>
          <span className="text-[13px] text-dp-muted">Painel editorial · acesso restrito à equipe</span>
        </div>
      </aside>

      <main className="flex min-h-screen flex-[1_1_45%] items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-[400px] flex-col gap-[22px] animate-in fade-in slide-in-from-bottom-3 duration-500 ease-dp">
          <Logo size={40} className="self-start min-[900px]:hidden" />

          {mode === "login" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h1 className="m-0 text-[30px] font-bold">Entrar no painel</h1>
                <p className="m-0 text-sm text-dp-muted">Use seu e-mail da equipe Dopanima.</p>
              </div>
              <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-dp-muted">
                  E-mail
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      clearErr()
                    }}
                    placeholder="voce@dopanima.com"
                    aria-invalid={bad("email")}
                    className={fieldCls(bad("email"))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-dp-muted">
                  Senha
                  <span className="relative flex">
                    <input
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      value={pw}
                      onChange={(e) => {
                        setPw(e.target.value)
                        clearErr()
                      }}
                      placeholder="Sua senha"
                      aria-invalid={bad("pw")}
                      className={cn(fieldCls(bad("pw")), "pr-13")}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute top-1.5 right-1.5 grid size-9 cursor-pointer place-items-center rounded-lg text-dp-muted hover:text-dp-yellow"
                    >
                      {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
                    </button>
                  </span>
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={remember}
                    onClick={() => setRemember((v) => !v)}
                    className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-white"
                  >
                    <span className={cn("grid size-5 place-items-center rounded-md border-[1.5px] text-dp-bg", remember ? "border-dp-yellow bg-dp-yellow" : "border-white/40")}>
                      {remember && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                    </span>
                    Manter conectado
                  </button>
                  <button type="button" onClick={() => switchMode("forgot")} className="cursor-pointer text-[13px] font-semibold text-dp-yellow hover:text-dp-orange">
                    Esqueci minha senha
                  </button>
                </div>
                {err && (
                  <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-[#FF8A73]/40 bg-[#FF8A73]/10 px-3.5 py-3 text-[13px] leading-[1.45] text-[#FFD2C8]">
                    <CircleAlert className="size-[18px] shrink-0 text-[#FF8A73]" aria-hidden />
                    {err}
                  </div>
                )}
                <button type="submit" disabled={loading} className={submitCls}>
                  {loading && <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>
              {DEMO_ACCOUNT && (
              <div className="flex flex-col gap-2 rounded-[14px] border border-dashed border-dp-lilac/40 bg-dp-plum/25 px-4 py-3.5">
                <span className="text-xs font-semibold tracking-widest text-dp-lilac uppercase">Acesso de demonstração</span>
                <span className="text-[13px] text-dp-body">{DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(DEMO_ACCOUNT.email)
                    setPw(DEMO_ACCOUNT.password)
                    clearErr()
                  }}
                  className="h-7.5 cursor-pointer self-start rounded-full border border-dp-lilac px-3.5 text-xs font-semibold text-dp-lilac hover:bg-dp-lilac/12"
                >
                  Preencher
                </button>
              </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <h1 className="m-0 text-[30px] font-bold">Recuperar senha</h1>
                <p className="m-0 text-sm leading-normal text-dp-muted">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
              </div>
              {sent ? (
                <div role="status" className="flex items-start gap-3 rounded-[14px] border border-dp-green/40 bg-dp-green/10 p-4 text-sm leading-normal">
                  <Check className="size-5 shrink-0 text-dp-green" strokeWidth={2.5} aria-hidden />
                  <span>
                    Se existir uma conta para <strong>{email}</strong>, você vai receber o link em alguns minutos. Confira também a caixa de spam.
                  </span>
                </div>
              ) : (
                <form onSubmit={sendReset} noValidate className="flex flex-col gap-3.5">
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-dp-muted">
                    E-mail
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        clearErr()
                      }}
                      placeholder="voce@dopanima.com"
                      aria-invalid={bad("email")}
                      className={fieldCls(bad("email"))}
                    />
                  </label>
                  {err && <span role="alert" className="text-[13px] text-[#FF8A73]">{err}</span>}
                  <button type="submit" className={submitCls}>Enviar link</button>
                </form>
              )}
              <button type="button" onClick={() => switchMode("login")} className="cursor-pointer self-start text-[13px] font-semibold text-dp-yellow hover:text-dp-orange">
                ← Voltar para o login
              </button>
            </>
          )}

          <div className="h-px bg-white/10" />
          <Link href="/" className="self-start text-[13px] font-semibold text-dp-yellow no-underline hover:text-dp-orange">
            Ir para o blog
          </Link>
        </div>
      </main>
    </div>
  )
}
