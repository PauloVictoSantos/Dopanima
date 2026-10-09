"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  Bell, Calendar, ChartLine, ExternalLink, FileText, Folder, House, Image as ImageIcon, Lock, LogOut, Menu,
  MessageSquare, PenLine, Plus, Search, Settings, Tag, User, Users, type LucideIcon,
} from "lucide-react"
import { Logo } from "@/components/brand"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { initials } from "@/lib/dashboard"
import { PASSWORD_CHANGE_EVENT } from "@/lib/api"
import { refreshSession, signOut, useSession } from "@/lib/session"
import { cn } from "@/lib/utils"

/** perm: some of these permissions is needed to see the item (the API enforces it anyway). */
type NavItem = { label: string; icon: LucideIcon; href: string; badge?: "comments" | "notifs"; perm?: string[] }
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Conteúdo",
    items: [
      { label: "Visão geral", icon: House, href: "/painel" },
      { label: "Posts", icon: FileText, href: "/painel/posts" },
      { label: "Novo post", icon: PenLine, href: "/painel/posts/novo", perm: ["create"] },
      { label: "Agendamento", icon: Calendar, href: "/painel/agendamento" },
      { label: "Categorias", icon: Folder, href: "/painel/categorias" },
      { label: "Tags", icon: Tag, href: "/painel/tags" },
      { label: "Biblioteca de mídia", icon: ImageIcon, href: "/painel/midia", perm: ["media", "editAll"] },
    ],
  },
  {
    group: "Comunidade",
    items: [
      { label: "Comentários", icon: MessageSquare, href: "/painel/comentarios", badge: "comments", perm: ["moderate"] },
      { label: "Usuários", icon: Users, href: "/painel/usuarios", perm: ["users"] },
      { label: "Permissões", icon: Lock, href: "/painel/permissoes", perm: ["users"] },
    ],
  },
  {
    group: "Crescimento",
    items: [
      { label: "SEO", icon: Search, href: "/painel/seo", perm: ["seo", "analytics"] },
      { label: "Analytics", icon: ChartLine, href: "/painel/analytics", perm: ["analytics"] },
    ],
  },
  {
    group: "Conta",
    items: [
      { label: "Notificações", icon: Bell, href: "/painel/notificacoes", badge: "notifs" },
      { label: "Meu perfil", icon: User, href: "/painel/perfil" },
      { label: "Configurações", icon: Settings, href: "/painel/configuracoes", perm: ["settings"] },
    ],
  },
]

function isActive(href: string, pathname: string) {
  if (href === "/painel") return pathname === "/painel"
  // The editor ("Novo post") owns both /posts/novo and /posts/<id>.
  if (href === "/painel/posts") return pathname === "/painel/posts"
  if (href === "/painel/posts/novo") return pathname.startsWith("/painel/posts/")
  return pathname.startsWith(href)
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawer, setDrawer] = useState(false)
  const session = useSession()
  const signedIn = session === null ? null : !!session
  const mustChange = !!session && session.mustChangePassword
  const { pendingCount, unreadCount, profile, overviewQuery, setOverviewQuery, postsQuery, setPostsQuery, setPostsStatus } = useDashboard()

  // No session (or it expired): back to the login page. The API checks every request anyway.
  useEffect(() => {
    if (signedIn === false) router.replace("/login")
  }, [signedIn, router])

  // Temporary password: only the profile page (to set a new one) is usable.
  useEffect(() => {
    if (mustChange && pathname !== "/painel/perfil") router.replace("/painel/perfil")
  }, [mustChange, pathname, router])
  useEffect(() => {
    const onRequired = () => void refreshSession()
    window.addEventListener(PASSWORD_CHANGE_EVENT, onRequired)
    return () => window.removeEventListener(PASSWORD_CHANGE_EVENT, onRequired)
  }, [])

  const onOverview = pathname === "/painel"
  const onSearch = (v: string) => {
    if (onOverview) return setOverviewQuery(v)
    setPostsQuery(v)
    setPostsStatus("Todos")
    if (pathname !== "/painel/posts") router.push("/painel/posts")
  }

  if (!signedIn) return <div className="min-h-screen bg-dp-bg" aria-busy="true" />

  return (
    <div className="flex min-h-screen bg-dp-bg text-white">
      {drawer && <div onClick={() => setDrawer(false)} className="fixed inset-0 z-40 bg-black/55 lg:hidden" aria-hidden />}
      <aside
        aria-label="Menu do painel"
        className={cn(
          "fixed inset-y-0 left-0 z-41 h-screen w-62 shrink-0 flex-col gap-5 overflow-y-auto border-r border-white/8 bg-dp-deep px-4 py-6 lg:sticky lg:top-0 lg:flex",
          drawer ? "flex" : "hidden"
        )}
      >
        <div className="flex items-center gap-3 px-2">
          <Logo size={24} />
          <span className="rounded-full border border-dp-lilac/40 px-2 py-[3px] text-[11px] font-semibold tracking-[0.12em] text-dp-lilac uppercase">CMS</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((g) => ({ ...g, items: g.items.filter((n) => !n.perm || (session && n.perm.some((p) => session.permissions.includes(p)))) }))
            .filter((g) => g.items.length)
            .map((g) => (
            <div key={g.group} className="flex flex-col gap-0.5">
              <span className="px-3 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#9C8AA6] uppercase">{g.group}</span>
              {g.items.map((n) => {
                const active = isActive(n.href, pathname)
                const badge = n.badge === "comments" ? pendingCount : n.badge === "notifs" ? unreadCount : 0
                const cls = cn(
                  "flex h-10 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 text-left text-[13px] font-medium no-underline transition-colors hover:bg-white/6",
                  active ? "bg-dp-yellow/12 text-dp-yellow" : "text-dp-body"
                )
                return (
                  <Link key={n.label} href={n.href} onClick={() => setDrawer(false)} aria-current={active ? "page" : undefined} className={cls}>
                    <n.icon className="size-4.5" aria-hidden />
                    <span className="flex-1">{n.label}</span>
                    {badge > 0 && (
                      <span className="grid h-5 min-w-5.5 place-items-center rounded-full bg-dp-orange px-1.5 text-[11px] font-semibold text-white">{badge}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
          <button
            onClick={async () => {
              await signOut()
              router.replace("/login")
            }}
            className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 text-left text-[13px] font-medium text-dp-body transition-colors hover:bg-white/6"
          >
            <LogOut className="size-4.5" aria-hidden />
            Sair
          </button>
        </nav>
        <Link
          href="/"
          className="mt-auto flex h-10 items-center gap-2.5 rounded-[10px] border border-white/14 px-3 text-[13px] font-medium text-white no-underline hover:border-dp-yellow hover:text-dp-yellow"
        >
          <ExternalLink className="size-4" aria-hidden />
          Ver blog
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/8 bg-dp-bg/90 backdrop-blur-[14px]">
          <div className="flex flex-wrap items-center gap-3 px-[clamp(16px,3vw,32px)] py-3.5">
            <button
              onClick={() => setDrawer(true)}
              aria-label="Abrir menu"
              className="grid size-10 cursor-pointer place-items-center rounded-full border border-white/30 lg:hidden"
            >
              <Menu className="size-4.5" aria-hidden />
            </button>
            <label className="flex h-10 max-w-105 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-full border border-white/14 bg-white/6 px-4">
              <Search className="size-4 text-dp-muted" aria-hidden />
              <input
                value={onOverview ? overviewQuery : postsQuery}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Buscar posts, autores, tags..."
                aria-label="Buscar"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
              />
            </label>
            <div className="ml-auto flex items-center gap-2.5">
              <Link
                href="/painel/notificacoes"
                aria-label={`Notificações, ${unreadCount} não lidas`}
                className="relative grid size-10 place-items-center rounded-full border border-white/20 text-white no-underline hover:border-dp-yellow"
              >
                <Bell className="size-4.5" aria-hidden />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4.5 min-w-4.5 rounded-full bg-dp-orange px-[5px] text-center text-[10px] leading-4.5 font-bold text-white">{unreadCount}</span>
                )}
              </Link>
              <Link
                href="/painel/posts/novo"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-dp-orange px-5 text-xs font-semibold tracking-[0.08em] text-white uppercase no-underline transition-transform duration-200 ease-dp hover:scale-[1.03] active:scale-[0.97]"
              >
                <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
                Novo post
              </Link>
              <Link
                href="/painel/perfil"
                aria-label="Meu perfil"
                className="grid size-10 place-items-center rounded-full border border-white/40 text-xs font-semibold text-white no-underline hover:border-dp-yellow"
                style={{ background: profile.photo ? `url("${profile.photo}") center/cover no-repeat` : "#B5179E" }}
              >
                {profile.photo ? "" : initials(profile.name)}
              </Link>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
