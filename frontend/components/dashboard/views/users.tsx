"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, X } from "lucide-react"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Avatar, Field, PageHeading, PageMain, PillTabs, btnOutline, btnPrimary, inputCls, selectCls } from "@/components/dashboard/ui"
import { errorMessage } from "@/lib/api"
import { ROLE_CODE, USER_STATUS_CODE, toDashUser, usersApi, type UserStats } from "@/lib/dashboard-api"
import { ROLES, USER_ROLES, USER_ROLE_STYLE, USER_STATUS_COLOR, fmtDate, isEmail, nf, type DashUser, type UserRole, type UserStatus } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

type Tab = "all" | "team" | "readers" | "pending" | "suspended"
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "team", label: "Equipe" },
  { key: "readers", label: "Leitores" },
  { key: "pending", label: "Pendentes" },
  { key: "suspended", label: "Suspensos" },
]
type Sort = "recent" | "active" | "name"

const small = "h-7.5 shrink-0 cursor-pointer rounded-full border px-3 text-xs font-semibold whitespace-nowrap"

function Box({ on, label, onClick }: { on: boolean; label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn("grid size-5 cursor-pointer place-items-center rounded-md border-[1.5px] p-0 text-dp-bg", on ? "border-dp-yellow bg-dp-yellow" : "border-white/35")}
    >
      {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
    </button>
  )
}

function RoleChip({ role }: { role: UserRole }) {
  const [bg, fg] = USER_ROLE_STYLE[role]
  return (
    <span className="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap" style={{ background: bg, color: fg }}>
      {role}
    </span>
  )
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** Senhas temporárias: não há envio de e-mail, então o admin copia e repassa. */
function showPassword(email: string, pw: string) {
  toast.success(`Senha temporária de ${email}: ${pw}`, {
    duration: 20000,
    action: { label: "Copiar", onClick: () => navigator.clipboard.writeText(pw).catch(() => {}) },
  })
}

export function UsersView() {
  const { me, reloadPosts } = useDashboard()
  const selfId = me?.id ?? 0
  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "Todas">("Todas")
  const [sort, setSort] = useState<Sort>("recent")
  const [rows, setRows] = useState<DashUser[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Record<number, boolean>>({})
  const [openId, setOpenId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<{ name: string; email: string; role: UserRole }>({ name: "", email: "", role: "Leitor" })
  const [draftErr, setDraftErr] = useState("")

  const load = useCallback(async () => {
    try {
      const [list, st] = await Promise.all([
        usersApi.list({ tab, q: q.trim(), role: roleFilter === "Todas" ? undefined : ROLE_CODE[roleFilter], sort }),
        usersApi.stats(),
      ])
      setRows(list.items.map(toDashUser))
      setCounts(list.counts)
      setStats(st)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [tab, q, roleFilter, sort])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const selectable = rows.filter((u) => u.id !== selfId)
  const selIds = Object.keys(sel).map(Number).filter((id) => sel[id] && id !== selfId)
  const allSel = selectable.length > 0 && selectable.every((u) => sel[u.id])
  const open = rows.find((u) => u.id === openId)

  const run = async (task: () => Promise<unknown>, msg: string) => {
    try {
      await task()
      setSel({})
      await load()
      toast.success(msg)
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    }
  }

  const bulk = (action: "activate" | "suspend" | "delete", msg: string) => {
    if (action === "delete" && !window.confirm(`Excluir ${selIds.length} usuário(s)? Os posts deles passam para você.`)) return
    void run(() => usersApi.bulk(selIds, action), msg).then((ok) => {
      if (ok && action === "delete") void reloadPosts()
    })
  }

  const exportCsv = () => {
    const csv = ["nome,email,funcao,status,cadastro", ...rows.map((u) => [u.name, u.email, u.role, u.status, u.joined].map(csvCell).join(","))].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "usuarios-dopanima.csv"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success(`CSV exportado com ${rows.length} usuários`)
  }

  const create = async () => {
    const name = draft.name.trim()
    const email = draft.email.trim()
    if (!name) return setDraftErr("Digite o nome.")
    if (!isEmail(email)) return setDraftErr("Digite um e-mail válido.")
    try {
      const { user, temporaryPassword } = await usersApi.create({ name, email, role: ROLE_CODE[draft.role] })
      setCreating(false)
      setDraft({ name: "", email: "", role: "Leitor" })
      await load()
      setOpenId(user.id)
      if (temporaryPassword) showPassword(email, temporaryPassword)
    } catch (e) {
      setDraftErr(errorMessage(e))
    }
  }

  const kpis: [string, string, string, string][] = [
    ["Total de usuários", nf(stats?.total ?? 0), "#fff", `+${stats?.newLast30 ?? 0} nos últimos 30 dias`],
    ["Ativos no mês", nf(stats?.activeMonth ?? 0), "#8BE04E", stats?.total ? `${Math.round((stats.activeMonth / stats.total) * 100)}% da base` : "—"],
    ["Equipe editorial", String(stats?.team ?? 0), "#F7E27A", "com acesso ao painel"],
    ["Suspensos", String(stats?.suspended ?? 0), "#FF8A73", "por spam ou abuso"],
  ]
  const bars = stats?.signups ?? []
  const maxBar = Math.max(1, ...bars)

  return (
    <PageMain>
      <PageHeading eyebrow="Leitores e equipe do Dopanima" title="Usuários">
        <button onClick={exportCsv} className={btnOutline}>Exportar CSV</button>
        <button
          onClick={() => {
            setCreating(true)
            setOpenId(null)
            setDraftErr("")
          }}
          className={btnPrimary + " tracking-[0.06em]"}
        >
          + Novo usuário
        </button>
      </PageHeading>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {kpis.map(([label, value, color, sub]) => (
          <div key={label} className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/4 p-4.5">
            <span className="text-[13px] text-dp-muted">{label}</span>
            <span className="text-[28px] font-bold tabular-nums" style={{ color }}>{value}</span>
            <span className="text-xs text-dp-muted">{sub}</span>
          </div>
        ))}
      </div>

      <PillTabs
        label="Filtrar usuários"
        active={tab}
        onSelect={(k) => {
          setTab(k)
          setSel({})
        }}
        items={TABS.map((t) => ({ ...t, count: counts[t.key] ?? 0 }))}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuários" className={inputCls + " flex-[1_1_260px]"} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | "Todas")} aria-label="Função" className={selectCls + " flex-[0_1_180px]"}>
          <option value="Todas">Todas as funções</option>
          {USER_ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar" className={selectCls + " flex-[0_1_180px]"}>
          <option value="recent">Cadastro mais recente</option>
          <option value="active">Mais ativos</option>
          <option value="name">Nome (A–Z)</option>
        </select>
      </div>

      {selIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-dp-yellow/35 bg-dp-yellow/8 px-3.5 py-2.5">
          <span className="mr-auto text-[13px] font-semibold">{selIds.length} selecionados</span>
          <button onClick={() => bulk("activate", `${selIds.length} usuários ativados`)} className={cn(small, "border-dp-green text-dp-green")}>Ativar</button>
          <button onClick={() => bulk("suspend", `${selIds.length} usuários suspensos`)} className={cn(small, "border-dp-yellow text-dp-yellow")}>Suspender</button>
          <button onClick={() => bulk("delete", `${selIds.length} usuários excluídos`)} className={cn(small, "border-[#FF8A73]/50 text-[#FF8A73]")}>Excluir</button>
          <button onClick={() => setSel({})} className={cn(small, "border-white/30 text-white")}>Limpar seleção</button>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section className="min-w-0 flex-[2_1_620px] overflow-x-auto rounded-2xl border border-white/10 bg-white/4 px-3 py-2 [scrollbar-color:rgba(255,255,255,.2)_transparent]">
          <table className="w-full min-w-190 border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-xs text-[#9C8AA6] [&>th]:px-2.5 [&>th]:py-3 [&>th]:font-medium">
                <th className="w-9">
                  <Box on={allSel} label="Selecionar todos" onClick={() => setSel(allSel ? {} : Object.fromEntries(selectable.map((u) => [u.id, true])))} />
                </th>
                <th>Usuário</th><th>Função</th><th>Status</th><th className="text-right">Posts</th><th>Cadastro</th><th>Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => {
                    setOpenId(u.id)
                    setCreating(false)
                  }}
                  className={cn("cursor-pointer hover:bg-white/4 [&>td]:border-t [&>td]:border-white/6 [&>td]:p-2.5", openId === u.id && "bg-dp-yellow/6")}
                >
                  <td>
                    <Box
                      on={!!sel[u.id]}
                      label={"Selecionar " + u.name}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (u.id === selfId) return toast("Você não pode selecionar a própria conta")
                        setSel((s) => ({ ...s, [u.id]: !s[u.id] }))
                      }}
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar ini={u.ini} color={u.color} size={36} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <button onClick={() => setOpenId(u.id)} className="cursor-pointer text-left font-semibold text-white hover:text-dp-yellow">{u.name}</button>
                        <span className="text-xs text-dp-muted">{u.email}</span>
                      </span>
                    </div>
                  </td>
                  <td><RoleChip role={u.role} /></td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-dp-muted">
                      <span className="size-2 rounded-full" style={{ background: USER_STATUS_COLOR[u.status] }} />
                      {u.status}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{u.posts}</td>
                  <td className="whitespace-nowrap text-dp-muted">{u.joined}</td>
                  <td className="whitespace-nowrap text-dp-muted">{u.last}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="m-0 px-2.5 py-5 text-[13px] text-dp-muted">{loading ? "Carregando usuários..." : "Nenhum usuário encontrado."}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 px-2.5 pt-3 pb-1.5 text-xs text-[#9C8AA6]">
            <span>Mostrando {rows.length} usuários</span>
            <span>{stats?.total ?? 0} cadastros no total</span>
          </div>
        </section>

        <section className="sticky top-22.5 flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 rounded-2xl border border-white/10 bg-white/4 p-5">
          {creating ? (
            <>
              <h2 className="m-0 text-base font-semibold">Novo usuário</h2>
              <Field label="Nome">
                <input value={draft.name} onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setDraftErr("") }} placeholder="Nome completo" className={inputCls} />
              </Field>
              <Field label="E-mail">
                <input type="email" value={draft.email} onChange={(e) => { setDraft((d) => ({ ...d, email: e.target.value })); setDraftErr("") }} placeholder="nome@email.com" className={inputCls} />
              </Field>
              <Field label="Função">
                <select value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as UserRole }))} className={selectCls}>
                  {USER_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <span className="text-xs text-dp-muted">Uma senha temporária será gerada. A conta fica pendente até o primeiro login.</span>
              {draftErr && <span role="alert" className="text-xs text-dp-yellow">{draftErr}</span>}
              <div className="flex gap-2">
                <button onClick={create} className={btnPrimary + " flex-1 tracking-[0.06em]"}>Criar usuário</button>
                <button onClick={() => setCreating(false)} className={btnOutline}>Cancelar</button>
              </div>
            </>
          ) : open ? (
            <UserDetail
              user={open}
              self={open.id === selfId}
              onClose={() => setOpenId(null)}
              onUpdate={(patch, msg) => run(() => usersApi.update(open.id, patch), msg)}
              onReset={async () => {
                try {
                  const { temporaryPassword } = await usersApi.resetPassword(open.id)
                  showPassword(open.email, temporaryPassword)
                } catch (e) {
                  toast.error(errorMessage(e))
                }
              }}
              onRemove={async () => {
                if (!window.confirm(`Excluir a conta de ${open.name}? Os posts passam para você.`)) return
                if (await run(() => usersApi.remove(open.id), `Conta de ${open.name} excluída`)) {
                  setOpenId(null)
                  void reloadPosts()
                }
              }}
            />
          ) : (
            <>
              <h2 className="m-0 text-base font-semibold">Novos cadastros (30 dias)</h2>
              <div className="flex h-27.5 items-end gap-[3px]">
                {bars.map((n, i) => (
                  <span key={i} title={`${n} cadastros`} className="flex-1 rounded-t-[3px]" style={{ height: `${Math.max(2, (n / maxBar) * 100)}%`, background: i === bars.length - 1 ? "#F7E27A" : "#C9A0E0" }} />
                ))}
              </div>
              <div className="flex justify-between text-xs text-[#9C8AA6]">
                <span>{stats ? fmtDate(stats.signupsFrom) : ""}</span>
                <span>{stats ? fmtDate(stats.signupsTo) : ""}</span>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/8 pt-3">
                {([["Leitores", String(stats?.byRole.reader ?? 0), "rgba(255,255,255,.35)"], ...ROLES.map((r) => [r, String(stats?.byRole[ROLE_CODE[r]] ?? 0), USER_ROLE_STYLE[r][0]])] as [string, string, string][]).map(
                  ([label, n, color]) => (
                    <div key={label} className="flex items-center gap-2.5 text-[13px]">
                      <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
                      <span className="flex-1">{label}</span>
                      <span className="font-bold tabular-nums">{n}</span>
                    </div>
                  )
                )}
              </div>
              <span className="text-xs text-dp-muted">Clique em um usuário para ver os detalhes.</span>
            </>
          )}
        </section>
      </div>
    </PageMain>
  )
}

function UserDetail({
  user: u,
  self,
  onClose,
  onUpdate,
  onReset,
  onRemove,
}: {
  user: DashUser
  self: boolean
  onClose: () => void
  onUpdate: (patch: { role?: string; status?: string }, msg: string) => void
  onReset: () => void
  onRemove: () => void
}) {
  const suspended = u.status === "Suspenso"
  const info: [string, string][] = [
    ["Status", u.status],
    ["Cadastro", u.joined],
    ["Último acesso", u.last],
    ["Cidade", u.city],
  ]

  return (
    <>
      <div className="flex items-center gap-3.5">
        <Avatar ini={u.ini} color={u.color} size={56} className="border-2 border-white/30 text-lg font-bold" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[17px] font-bold">{u.name}</span>
          <span className="text-xs wrap-anywhere text-dp-muted">{u.email}</span>
        </span>
        <button onClick={onClose} aria-label="Fechar" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-white/25">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 border-y border-white/8 py-3">
        {[["Posts", u.posts], ["Comentários", u.comments]].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <span className="text-lg font-bold">{v}</span>
            <span className="text-[11px] text-dp-muted">{k}</span>
          </div>
        ))}
      </div>
      <Field label="Função">
        <select
          value={u.role}
          disabled={self}
          onChange={(e) => onUpdate({ role: ROLE_CODE[e.target.value as UserRole] }, `${u.name} agora é ${e.target.value}`)}
          className={selectCls + " disabled:opacity-60"}
        >
          {USER_ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-xs">
        {info.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[#9C8AA6]">{k}</dt>
            <dd className="m-0 wrap-anywhere">{v}</dd>
          </div>
        ))}
      </dl>
      {!self && (
        <div className="flex flex-wrap gap-2">
          <button onClick={onReset} className={cn(small, "border-white/30 text-white")}>
            Gerar nova senha
          </button>
          <button
            onClick={() => {
              const status: UserStatus = suspended ? "Ativo" : "Suspenso"
              onUpdate({ status: USER_STATUS_CODE[status] }, status === "Ativo" ? "Conta reativada" : "Conta suspensa")
            }}
            className={cn(small, suspended ? "border-dp-green text-dp-green" : "border-dp-yellow text-dp-yellow")}
          >
            {suspended ? "Reativar conta" : "Suspender conta"}
          </button>
          <button onClick={onRemove} className={cn(small, "border-[#FF8A73]/50 text-[#FF8A73]")}>Excluir conta</button>
        </div>
      )}
    </>
  )
}
