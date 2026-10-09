"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Field, PageHeading, PageMain, Panel, SwitchRow, btnOutline, btnPrimary, inputCls, textareaCls } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { ROLE_LABEL, mediaApi, profileApi } from "@/lib/dashboard-api"
import { initials, nf, type Profile } from "@/lib/dashboard"
import { setMe, signOutEverywhere } from "@/lib/session"

type TextKey = "name" | "email" | "site" | "insta" | "x"

export function ProfileView() {
  const router = useRouter()
  const { profile: p, setProfile, posts, me, can } = useDashboard()
  const [pw, setPw] = useState({ cur: "", nw: "", cf: "" })
  const [pwErr, setPwErr] = useState("")
  const [busy, setBusy] = useState(false)
  const mustChange = !!me?.mustChangePassword

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((x) => ({ ...x, [key]: value }))
  const field = (key: TextKey, label: string, type = "text", ph = "") => (
    <Field key={key} label={label}>
      <input type={type} value={p[key]} onChange={(e) => set(key, e.target.value)} placeholder={ph} className={inputCls} />
    </Field>
  )

  // A regra de senha (tamanho, senhas comuns...) é validada pela API.
  const changePw = async () => {
    if (!pw.cur) return setPwErr("Digite sua senha atual.")
    if (pw.nw !== pw.cf) return setPwErr("As senhas não conferem.")
    setBusy(true)
    try {
      setMe(await profileApi.update({ currentPassword: pw.cur, newPassword: pw.nw }))
      setPw({ cur: "", nw: "", cf: "" })
      setPwErr("")
      toast.success(mustChange ? "Senha definida. Bem-vindo(a) ao painel!" : "Senha alterada. As outras sessões foram encerradas.")
      if (mustChange) router.replace("/painel")
    } catch (e) {
      setPwErr(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const saveProfile = async () => {
    setBusy(true)
    try {
      setMe(await profileApi.update({ name: p.name, email: p.email, bio: p.bio }))
      toast.success("Perfil salvo")
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const changePhoto = async (file: File) => {
    try {
      const [m] = await mediaApi.upload([file], "Geral")
      setMe(await profileApi.update({ avatarUrl: m.url }))
      toast.success("Foto atualizada")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const mine = posts.filter((x) => x.authorId === me?.id)
  const stats = [
    { k: "Posts", v: nf(mine.length) },
    { k: "Visualizações", v: nf(mine.reduce((a, x) => a + x.views, 0)) },
    { k: "Comentários", v: nf(mine.reduce((a, x) => a + x.comments, 0)) },
  ]

  return (
    <PageMain className="max-w-300">
      <PageHeading eyebrow="Conta" title="Meu perfil" />
      {mustChange && (
        <div role="alert" className="rounded-2xl border border-dp-yellow/50 bg-dp-yellow/10 px-4.5 py-3.5 text-sm leading-normal">
          <b className="text-dp-yellow">Defina uma nova senha para continuar.</b> Você entrou com uma senha temporária; o resto do painel fica bloqueado até trocá-la.
        </div>
      )}
      <div className="flex flex-wrap items-start gap-5">
        <Panel className="flex-[1_1_260px] items-center gap-3 p-6 text-center">
          <span
            className="grid size-28 place-items-center rounded-full border-[3px] border-dp-yellow text-[34px] font-bold"
            style={{ background: p.photo ? `url("${p.photo}") center/cover no-repeat` : "#B5179E" }}
          >
            {p.photo ? "" : initials(p.name)}
          </span>
          {can("media") && !mustChange && (
            <label className="inline-flex h-8 cursor-pointer items-center rounded-full border border-white/30 px-3.5 text-xs font-semibold whitespace-nowrap hover:border-dp-yellow hover:text-dp-yellow">
              Trocar foto
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ""
                  if (f) void changePhoto(f)
                }}
              />
            </label>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">{p.name}</span>
            <span className="text-[13px] text-dp-muted">{p.email}</span>
          </div>
          <span className="inline-flex h-6.5 items-center rounded-full bg-dp-magenta px-3 text-xs font-semibold whitespace-nowrap">{me ? ROLE_LABEL[me.role] : ""}</span>
          <div className="mt-2 grid w-full grid-cols-3 gap-2 border-t border-white/8 pt-4">
            {stats.map((s) => (
              <div key={s.k} className="flex flex-col gap-0.5">
                <span className="text-lg font-bold">{s.v}</span>
                <span className="text-[11px] text-dp-muted">{s.k}</span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-4">
          <Panel className="gap-3">
            <h2 className="m-0 text-base font-semibold">Informações pessoais</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {field("name", "Nome")}
              {field("email", "E-mail", "email")}
              {field("site", "Página de autor")}
              {field("insta", "Instagram", "text", "@usuario")}
              {field("x", "X", "text", "@usuario")}
            </div>
            <Field label="Bio (aparece nos seus posts)">
              <textarea value={p.bio} onChange={(e) => set("bio", e.target.value)} rows={3} className={textareaCls} />
            </Field>
            <button onClick={saveProfile} disabled={busy || mustChange} className={btnPrimary + " self-start px-6 disabled:opacity-60"}>
              Salvar perfil
            </button>
          </Panel>

          <Panel className="gap-3">
            <h2 className="m-0 text-base font-semibold">Senha</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
              {([["cur", "Senha atual", "current-password"], ["nw", "Nova senha", "new-password"], ["cf", "Confirmar nova senha", "new-password"]] as const).map(([key, label, ac]) => (
                <Field key={key} label={label}>
                  <input
                    type="password"
                    autoComplete={ac}
                    value={pw[key]}
                    onChange={(e) => {
                      const v = e.target.value
                      setPw((x) => ({ ...x, [key]: v }))
                      setPwErr("")
                    }}
                    className={inputCls}
                  />
                </Field>
              ))}
            </div>
            {pwErr && <span role="alert" className="text-xs text-dp-yellow">{pwErr}</span>}
            <span className="text-xs text-dp-muted">Mínimo de 8 caracteres; senhas muito comuns são recusadas. Trocar a senha encerra suas outras sessões.</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={changePw} disabled={busy} className={btnOutline + " px-5"}>{mustChange ? "Definir nova senha" : "Alterar senha"}</button>
              {!mustChange && (
                <button
                  onClick={async () => {
                    if (!window.confirm("Encerrar sua sessão em todos os dispositivos, inclusive este?")) return
                    try {
                      await signOutEverywhere()
                      router.replace("/login")
                    } catch (e) {
                      toast.error(errorMessage(e))
                    }
                  }}
                  className="h-10 cursor-pointer rounded-full border border-[#FF8A73]/50 px-5 text-xs font-semibold text-[#FF8A73] hover:bg-[#FF8A73]/10"
                >
                  Sair de todos os dispositivos
                </button>
              )}
            </div>
          </Panel>

          <Panel className="gap-1">
            <h2 className="m-0 mb-1.5 text-base font-semibold">Notificações</h2>
            <SwitchRow label="Novos comentários nos meus posts" desc="E-mail a cada comentário recebido" on={p.nComments} onToggle={() => set("nComments", !p.nComments)} />
            <SwitchRow label="Resumo semanal" desc="Desempenho dos seus posts toda segunda" on={p.nWeekly} onToggle={() => set("nWeekly", !p.nWeekly)} />
            <SwitchRow label="Lembrete de agendados" desc="Aviso 1 hora antes de cada publicação" on={p.nSched} onToggle={() => set("nSched", !p.nSched)} />
          </Panel>
        </div>
      </div>
    </PageMain>
  )
}
