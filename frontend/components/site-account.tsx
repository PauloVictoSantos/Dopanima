"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bookmark, LayoutDashboard, LogOut } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { siteLogout, useSiteUser } from "@/lib/site-session"

const itemCls = "cursor-pointer gap-2.5 py-1.5 text-[13px] text-white focus:bg-white/10 focus:text-white not-data-[variant=destructive]:focus:**:text-white"

/** Botão "Entrar" para visitantes ou menu da conta (Salvos, Painel, Sair). */
export function SiteAccount() {
  const user = useSiteUser()
  const router = useRouter()
  const pathname = usePathname()

  if (user === null) return <span className="size-9" aria-hidden />

  if (!user)
    return (
      <Link
        href={`/entrar?next=${encodeURIComponent(pathname || "/")}`}
        className="hidden h-9 items-center rounded-full border border-white/40 px-4 text-xs font-semibold text-white no-underline hover:border-dp-yellow hover:text-dp-yellow lg:inline-flex"
      >
        Entrar
      </Link>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Conta de ${user.name}`}
        className="hidden size-9 cursor-pointer place-items-center rounded-full border border-white/40 text-xs font-semibold text-white hover:border-dp-yellow data-popup-open:border-dp-yellow lg:grid"
        style={{ background: user.avatarUrl ? `url("${user.avatarUrl}") center/cover no-repeat` : user.color }}
      >
        {user.avatarUrl ? "" : user.initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 border border-white/12 bg-dp-panel text-white">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
            <span className="truncate text-[13px] font-semibold text-white">{user.name}</span>
            <span className="truncate text-xs text-[#9C8AA6]">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuGroup>
          <DropdownMenuItem className={itemCls} onClick={() => router.push("/salvos")}>
            <Bookmark className="size-4" aria-hidden /> Posts salvos
          </DropdownMenuItem>
          {user.staff && (
            <DropdownMenuItem className={itemCls} onClick={() => router.push("/painel")}>
              <LayoutDashboard className="size-4" aria-hidden /> Painel
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            className={itemCls + " text-[#FF8A73] focus:text-[#FF8A73] *:[svg]:text-[#FF8A73]"}
            onClick={async () => {
              await siteLogout()
              toast.success("Você saiu da sua conta")
              router.refresh()
            }}
          >
            <LogOut className="size-4" aria-hidden /> Sair
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
