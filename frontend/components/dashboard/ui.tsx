import type { LucideIcon } from "lucide-react"
import { CAT_COLOR, STATUS_COLOR, seoColor, thumbBg, type PostKind, type PostStatus } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

export const inputCls =
  "h-10 min-w-0 rounded-[10px] border border-white/18 bg-white/4 px-3.5 text-[13px] text-white outline-none transition-colors focus:border-dp-yellow"
export const selectCls = "h-10 min-w-0 rounded-[10px] border border-white/18 bg-[#1F0829] px-3 text-[13px] text-white scheme-dark"
export const textareaCls =
  "resize-y rounded-[10px] border border-white/18 bg-white/4 px-3.5 py-2.5 text-[13px] leading-normal text-white outline-none transition-colors focus:border-dp-yellow"
export const btnPrimary =
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-dp-orange px-5 text-xs font-semibold tracking-[0.08em] whitespace-nowrap text-white uppercase transition-transform duration-200 ease-dp hover:scale-[1.03] active:scale-[0.97]"
export const btnOutline =
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/30 px-4.5 text-xs font-semibold whitespace-nowrap text-white transition-colors hover:border-dp-yellow hover:text-dp-yellow"
export const btnDanger =
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#FF8A73]/50 px-4.5 text-xs font-semibold whitespace-nowrap text-[#FF8A73] transition-colors hover:bg-[#FF8A73]/10"

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("flex min-w-0 flex-col gap-4 rounded-2xl border border-white/10 bg-white/4 p-5", className)} {...props} />
}

export function PageMain({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "flex w-full max-w-360 flex-col gap-5 px-[clamp(16px,3vw,32px)] pt-7 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-400 ease-dp",
        className
      )}
      {...props}
    />
  )
}

export function PageHeading({ eyebrow, title, eyebrowClass, children }: { eyebrow: React.ReactNode; title: string; eyebrowClass?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <span className={cn("text-xs text-dp-muted", eyebrowClass)}>{eyebrow}</span>
        <h1 className="m-0 text-[28px] font-bold">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function SectionTitle({ id, children, aside }: { id?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id={id} className="m-0 text-base font-semibold">{children}</h2>
      {aside && <span className="text-xs text-dp-muted">{aside}</span>}
    </div>
  )
}

/** Yellow-when-active pill, used for tabs and filters across the panel. */
export function pillCls(active: boolean) {
  return cn(
    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-xs font-semibold whitespace-nowrap transition-colors",
    active ? "border-dp-yellow bg-dp-yellow text-dp-bg" : "border-white/30 bg-transparent text-white hover:border-white/60"
  )
}

export function PillTabs<K extends string>({
  items,
  active,
  onSelect,
  label,
  role = "tablist",
}: {
  items: { key: K; label: string; count?: number }[]
  active: K
  onSelect: (k: K) => void
  label: string
  role?: "tablist" | "group"
}) {
  return (
    <div role={role} aria-label={label} className="no-scrollbar flex gap-2 overflow-x-auto p-0.5">
      {items.map((t) => (
        <button
          key={t.key}
          {...(role === "tablist" ? { role: "tab", "aria-selected": t.key === active } : { "aria-pressed": t.key === active })}
          onClick={() => onSelect(t.key)}
          className={pillCls(t.key === active)}
        >
          {t.label}
          {t.count != null && <span className="font-medium opacity-75">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn("h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors", on ? "bg-dp-green" : "bg-white/18")}
    >
      <span className={cn("block size-5 rounded-full bg-white transition-transform", on && "translate-x-5")} />
    </button>
  )
}

export function SwitchRow({ label, desc, on, onToggle, divider = true }: { label: string; desc?: string; on: boolean; onToggle: () => void; divider?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2.5", divider && "border-b border-white/6")}>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold">{label}</span>
        {desc && <span className="text-xs text-dp-muted">{desc}</span>}
      </span>
      <Switch on={on} onToggle={onToggle} label={label} />
    </div>
  )
}

export function Field({ label, aside, className, children }: { label: React.ReactNode; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5 text-xs font-medium text-dp-muted", className)}>
      {aside ? (
        <span className="flex justify-between">
          {label}
          {aside}
        </span>
      ) : (
        label
      )}
      {children}
    </label>
  )
}

export function IconAction({ label, icon: Icon, color = "#fff", onClick, size = 32 }: { label: string; icon: LucideIcon; color?: string; onClick: () => void; size?: number }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid shrink-0 cursor-pointer place-items-center rounded-lg border border-white/14 transition-colors hover:bg-white/8"
      style={{ width: size, height: size, color }}
    >
      <Icon className="size-[15px]" aria-hidden />
    </button>
  )
}

export function CatChip({ kind, label }: { kind: PostKind; label?: string }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap text-dp-bg" style={{ background: CAT_COLOR[kind] }}>
      {label ?? kind}
    </span>
  )
}

export function StatusPill({ status, label, color }: { status?: PostStatus; label?: string; color?: string }) {
  const c = color ?? (status ? STATUS_COLOR[status] : "#CFCFCF")
  return (
    <span className="inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap" style={{ borderColor: c, color: c }}>
      {label ?? status}
    </span>
  )
}

export function SeoBadge({ score }: { score: number }) {
  const c = seoColor(score)
  return (
    <span className="inline-flex h-6 min-w-10 items-center justify-center rounded-full border text-xs font-semibold" style={{ borderColor: c, color: c }}>
      {score}
    </span>
  )
}

export function Thumb({ url, className }: { url: string; className?: string }) {
  return <span aria-hidden className={cn("block h-14 w-10 shrink-0 rounded-lg border border-white/12", className)} style={{ background: thumbBg(url) }} />
}

export function Avatar({ ini, color, size = 34, className }: { ini: string; color: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold", className)}
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.35) }}
    >
      {ini}
    </span>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[13px] text-dp-muted">{children}</p>
}
