"use client"

import { Fragment, useState } from "react"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Avatar, Field, PageHeading, PageMain, Panel, btnPrimary, inputCls, selectCls } from "@/components/dashboard/ui"
import { PERMISSIONS, ROLES, ROLE_DESC, SELF_ID, initials, isEmail, newId, type Role } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

export function PermissionsView() {
  const { perms, setPerms, team, setTeam } = useDashboard()
  const [invite, setInvite] = useState<{ email: string; role: Role }>({ email: "", role: "Autor" })

  const toggle = (role: Role, key: string) => {
    if (role === "Super Admin") return toast("Super Admin sempre tem acesso total")
    setPerms((p) => ({ ...p, [role]: { ...p[role], [key]: !p[role][key] } }))
  }

  const sendInvite = () => {
    const email = invite.email.trim()
    if (!isEmail(email)) return toast.error("Digite um e-mail válido")
    const name = email.split("@")[0]
    setTeam((t) => [...t, { id: newId(), name, email, role: invite.role, ini: initials(name) || name.slice(0, 2).toUpperCase(), color: "#26113A", last: "convite enviado" }])
    setInvite({ email: "", role: "Autor" })
    toast.success("Convite enviado para " + email)
  }

  return (
    <PageMain>
      <PageHeading eyebrow={`${ROLES.length} funções · ${team.length} pessoas na equipe`} title="Permissões">
        <button onClick={() => toast.success("Permissões salvas")} className={btnPrimary + " tracking-[0.06em]"}>Salvar permissões</button>
      </PageHeading>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        {ROLES.map((r) => (
          <div key={r} className="flex flex-col gap-1.5 rounded-[14px] border border-white/10 bg-white/4 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">{r}</span>
              <span className="shrink-0 text-xs font-semibold text-dp-yellow">{team.filter((m) => m.role === r).length} pessoas</span>
            </div>
            <span className="text-xs leading-normal text-dp-muted">{ROLE_DESC[r]}</span>
          </div>
        ))}
      </div>

      <Panel className="overflow-x-auto [scrollbar-color:rgba(255,255,255,.2)_transparent]">
        <table className="w-full min-w-190 border-collapse text-[13px]">
          <thead>
            <tr className="text-xs text-[#9C8AA6]">
              <th className="border-b border-white/10 px-2.5 py-2 text-left font-medium">Permissão</th>
              {ROLES.map((r) => (
                <th key={r} className="border-b border-white/10 px-2.5 py-2 font-semibold whitespace-nowrap text-white">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map(([key, label, group], i) => {
              const newGroup = i === 0 || PERMISSIONS[i - 1][2] !== group
              return (
                <Fragment key={key}>
                  {newGroup && (
                    <tr>
                      <th colSpan={ROLES.length + 1} scope="colgroup" className="px-2.5 pt-4 pb-2 text-left text-[11px] font-semibold tracking-[0.12em] text-dp-lilac uppercase">
                        {group}
                      </th>
                    </tr>
                  )}
                  <tr className="hover:bg-white/3">
                    <td className="border-b border-white/6 p-2.5">{label}</td>
                    {ROLES.map((r) => {
                      const on = !!perms[r][key]
                      const locked = r === "Super Admin"
                      return (
                        <td key={r} className="border-b border-white/6 p-2.5 text-center">
                          <button
                            role="checkbox"
                            aria-checked={on}
                            aria-disabled={locked}
                            aria-label={`${label} para ${r}`}
                            onClick={() => toggle(r, key)}
                            className={cn(
                              "inline-grid size-6 place-items-center rounded-md border-[1.5px] p-0 text-dp-bg transition-colors",
                              on ? "border-dp-yellow bg-dp-yellow" : "border-white/30",
                              locked ? "cursor-not-allowed opacity-55" : "cursor-pointer"
                            )}
                          >
                            {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </Panel>

      <div className="flex flex-wrap items-start gap-5">
        <Panel className="flex-[2_1_520px] gap-1">
          <h2 className="m-0 mb-2 text-base font-semibold">Equipe</h2>
          {team.map((m) => {
            const self = m.id === SELF_ID
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 border-t border-white/6 py-2.5">
                <Avatar ini={m.ini} color={m.color} size={36} />
                <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
                  <span className="text-[13px] font-semibold">{m.name}</span>
                  <span className="text-xs text-dp-muted">{m.email} · {m.last}</span>
                </span>
                <select
                  value={m.role}
                  disabled={self}
                  aria-label={`Função de ${m.name}`}
                  onChange={(e) => {
                    const role = e.target.value as Role
                    setTeam((t) => t.map((x) => (x.id === m.id ? { ...x, role } : x)))
                    toast.success(`${m.name} agora é ${role}`)
                  }}
                  className={selectCls + " h-9 flex-[0_0_160px] disabled:opacity-60"}
                >
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
                {self ? (
                  <span className="w-19 shrink-0 text-xs font-semibold text-dp-green">Você</span>
                ) : (
                  <button
                    onClick={() => {
                      setTeam((t) => t.filter((x) => x.id !== m.id))
                      toast.success(`${m.name} removido da equipe`)
                    }}
                    className="h-7.5 shrink-0 cursor-pointer rounded-full border border-[#FF8A73]/45 px-3.5 text-xs font-semibold text-[#FF8A73] hover:bg-[#FF8A73]/10"
                  >
                    Remover
                  </button>
                )}
              </div>
            )
          })}
        </Panel>

        <Panel className="flex-[1_1_300px] gap-3">
          <h2 className="m-0 text-base font-semibold">Convidar pessoa</h2>
          <Field label="E-mail">
            <input
              type="email"
              value={invite.email}
              onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && sendInvite()}
              placeholder="nome@email.com"
              className={inputCls}
            />
          </Field>
          <Field label="Função">
            <select value={invite.role} onChange={(e) => setInvite((v) => ({ ...v, role: e.target.value as Role }))} className={selectCls}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <button onClick={sendInvite} className={btnPrimary + " tracking-[0.06em]"}>Enviar convite</button>
        </Panel>
      </div>
    </PageMain>
  )
}
