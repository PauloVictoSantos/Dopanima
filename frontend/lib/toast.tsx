"use client"

import type { ReactNode } from "react"
import { toast as sonner } from "sonner"
import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

// Mensagens de retorno (sucesso, erro, alteração) no componente Alert, com ícone e cor
// por status: verde = sucesso, vermelho = erro, azul = alteração, amarelo = aviso.
// Mesma API do sonner que o projeto já usava: toast.success(msg), toast.error(msg)...

type Kind = "success" | "error" | "info" | "warning"
type Options = { description?: ReactNode; duration?: number; action?: { label: string; onClick: () => void } }

const TONE: Record<Kind, { icon: typeof Info; color: string; border: string }> = {
  success: { icon: CircleCheck, color: "text-dp-green", border: "border-dp-green/45" },
  error: { icon: CircleX, color: "text-dp-red", border: "border-dp-red/50" },
  info: { icon: Info, color: "text-dp-blue", border: "border-dp-blue/45" },
  warning: { icon: TriangleAlert, color: "text-dp-yellow", border: "border-dp-yellow/50" },
}

/**
 * Sucessos que na verdade são alterações (salvar, atualizar, mover...) aparecem em azul.
 * Assim as chamadas toast.success("Perfil salvo") já existentes ganham a cor certa.
 */
const CHANGED = /\b(salv[oa]s?|atualizad|alterad|editad|renomead|movid|reagendad|restaurad|substitu[ií]d|preenchid|marcad|reordenad|corrigid|reescrit|encurtad|definid[oa] como|agora é)/i

function StatusAlert({ id, kind, message, description, action }: { id: string | number; kind: Kind; message: string } & Options) {
  const t = TONE[kind]
  return (
    <Alert
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "w-[min(380px,calc(100vw-32px))] items-start rounded-[14px] border bg-dp-panel py-3 pr-9 pl-3.5 font-sans text-white shadow-[0_12px_32px_rgb(0_0_0/0.45)]",
        "has-[>svg]:gap-x-2.5 *:[svg]:size-5! *:[svg]:translate-y-0",
        t.border
      )}
    >
      <t.icon className={t.color} aria-hidden />
      <AlertTitle className="text-sm leading-snug font-semibold break-words text-white">{message}</AlertTitle>
      {(description || action) && (
        <AlertDescription className="col-start-2 mt-1 flex flex-wrap items-center gap-2 text-xs text-dp-muted">
          {description}
          {action && (
            <button
              onClick={() => {
                action.onClick()
                sonner.dismiss(id)
              }}
              className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold text-white hover:bg-white/10", t.border)}
            >
              {action.label}
            </button>
          )}
        </AlertDescription>
      )}
      <button onClick={() => sonner.dismiss(id)} aria-label="Fechar" className="absolute top-2.5 right-2.5 cursor-pointer rounded-full p-0.5 text-dp-muted hover:text-white">
        <X className="size-3.5" />
      </button>
    </Alert>
  )
}

function show(kind: Kind, message: string, o: Options = {}) {
  return sonner.custom((id) => <StatusAlert id={id} kind={kind} message={message} {...o} />, { duration: o.duration ?? (kind === "error" ? 6000 : 4000) })
}

/** `toast("...")` sem tipo = aviso (amarelo), como "Entre na sua conta para salvar posts". */
export const toast = Object.assign((message: string, o?: Options) => show("warning", message, o), {
  success: (message: string, o?: Options) => show(CHANGED.test(message) ? "info" : "success", message, o),
  error: (message: string, o?: Options) => show("error", message, o),
  /** Alteração (azul). */
  info: (message: string, o?: Options) => show("info", message, o),
  warning: (message: string, o?: Options) => show("warning", message, o),
  dismiss: sonner.dismiss,
})
