"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { CircleHelp, Link2, TriangleAlert } from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Substitui window.confirm / window.prompt por um AlertDialog no visual do Dopanima.
// Uso: `if (!(await confirmDialog({ title: "Excluir?", tone: "danger" }))) return`

type Base = { title: string; description?: ReactNode; confirmLabel?: string; cancelLabel?: string }
export type ConfirmOptions = Base & { /** "danger" = ação destrutiva (vermelho). */ tone?: "danger" | "default" }
export type PromptOptions = Base & { label?: string; placeholder?: string; defaultValue?: string; type?: "text" | "url" }

type Request =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void }

// Fila simples: um diálogo por vez, os próximos esperam.
let queue: Request[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const current = () => queue[0] ?? null

export function confirmDialog(opts: ConfirmOptions) {
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { kind: "confirm", opts, resolve }]
    emit()
  })
}

export function promptDialog(opts: PromptOptions) {
  return new Promise<string | null>((resolve) => {
    queue = [...queue, { kind: "prompt", opts, resolve }]
    emit()
  })
}

function finish(value: boolean | string | null) {
  const req = queue[0]
  if (!req) return
  queue = queue.slice(1)
  if (req.kind === "confirm") req.resolve(value === true)
  else req.resolve(typeof value === "string" ? value : null)
  emit()
}

/** Montado uma vez no layout raiz. */
export function DialogHost() {
  const req = useSyncExternalStore(subscribe, current, () => null)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Cada pedido novo começa com o valor padrão dele.
  const [shown, setShown] = useState<Request | null>(null)
  if (req !== shown) {
    setShown(req)
    setValue(req?.kind === "prompt" ? (req.opts.defaultValue ?? "") : "")
  }
  useEffect(() => {
    if (req?.kind === "prompt") requestAnimationFrame(() => inputRef.current?.focus())
  }, [req])

  const danger = req?.kind === "confirm" && req.opts.tone === "danger"
  const Icon = req?.kind === "prompt" ? Link2 : danger ? TriangleAlert : CircleHelp
  const submit = () => finish(req?.kind === "prompt" ? value.trim() || null : true)

  return (
    <AlertDialog open={!!req} onOpenChange={(open) => !open && finish(req?.kind === "prompt" ? null : false)}>
      <AlertDialogContent className="border border-white/15 bg-dp-panel text-white ring-0 sm:max-w-md data-[size=default]:max-w-[calc(100vw-32px)] data-[size=default]:sm:max-w-md">
        {req && (
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <AlertDialogHeader>
              <AlertDialogMedia className={cn("rounded-full", danger ? "bg-red-500/15 text-red-400" : "bg-dp-yellow/15 text-dp-yellow")}>
                <Icon />
              </AlertDialogMedia>
              <AlertDialogTitle className="text-base font-semibold text-white">{req.opts.title}</AlertDialogTitle>
              {req.opts.description && <AlertDialogDescription className="text-dp-muted">{req.opts.description}</AlertDialogDescription>}
            </AlertDialogHeader>
            {req.kind === "prompt" && (
              <label className="flex flex-col gap-1.5 text-xs text-dp-muted">
                {req.opts.label}
                <Input ref={inputRef} type={req.opts.type ?? "text"} value={value} onChange={(e) => setValue(e.target.value)} placeholder={req.opts.placeholder} className="h-10" />
              </label>
            )}
            <AlertDialogFooter className="border-white/10 bg-white/3">
              <AlertDialogCancel type="button" className="rounded-full">{req.opts.cancelLabel ?? "Cancelar"}</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                className={cn(
                  "rounded-full font-semibold",
                  danger ? "bg-red-500 text-white hover:bg-red-500/85" : "bg-dp-yellow text-dp-bg hover:bg-dp-yellow/85"
                )}
                disabled={req.kind === "prompt" && !value.trim()}
              >
                {req.opts.confirmLabel ?? (req.kind === "prompt" ? "Inserir" : danger ? "Excluir" : "Confirmar")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
