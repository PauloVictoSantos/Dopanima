"use client"

import { MoreHorizontal, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type RowAction = {
  label: string
  icon: LucideIcon
  onClick: () => void
  /** Ações que apagam ou removem ficam em vermelho. */
  destructive?: boolean
  disabled?: boolean
}

/**
 * Menu "⋯" das linhas de tabela. Cada grupo é separado por uma linha;
 * grupos vazios são ignorados.
 */
export function RowActions({ label, groups }: { label: string; groups: RowAction[][] }) {
  const visible = groups.filter((g) => g.length)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Ações: ${label}`} className="size-8 rounded-full text-white hover:bg-white/10 data-popup-open:bg-white/10">
            <MoreHorizontal className="size-4.5" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52 border border-white/12 bg-dp-panel text-white">
        {visible.map((group, i) => (
          <DropdownMenuGroup key={i}>
            {/* No Base UI o rótulo precisa ficar dentro de um grupo. */}
            {i === 0 && <DropdownMenuLabel className="truncate text-[#9C8AA6]">{label}</DropdownMenuLabel>}
            {i > 0 && <DropdownMenuSeparator className="bg-white/10" />}
            {group.map((a) => (
              <DropdownMenuItem
                key={a.label}
                onClick={a.onClick}
                disabled={a.disabled}
                variant={a.destructive ? "destructive" : "default"}
                className="cursor-pointer gap-2.5 py-1.5 text-[13px] text-white focus:bg-white/10 focus:text-white not-data-[variant=destructive]:focus:**:text-white data-[variant=destructive]:text-[#FF8A73] data-[variant=destructive]:focus:bg-[#FF8A73]/12 data-[variant=destructive]:focus:text-[#FF8A73] data-[variant=destructive]:*:[svg]:text-[#FF8A73]"
              >
                <a.icon className="size-4" aria-hidden />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
