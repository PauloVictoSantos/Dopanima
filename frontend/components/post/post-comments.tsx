"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { toast } from "sonner"
import { API_URL, api, errorMessage } from "@/lib/api"
import { useSiteUser } from "@/lib/site-session"
import { cn } from "@/lib/utils"

type PublicComment = {
  id: number
  name: string
  initials: string
  color: string
  content: string
  time: string
  staff: boolean
  userId: number | null
  replies?: PublicComment[]
}

const MAX_TEXT = 2000

const fieldCls = "rounded-[10px] border border-white/20 bg-dp-bg/50 px-3.5 text-sm text-white outline-none transition-colors focus:border-dp-yellow"

function CommentItem({
  c,
  onReply,
  onDelete,
  myId,
  reply,
}: {
  c: PublicComment
  onReply?: (c: PublicComment) => void
  onDelete: (c: PublicComment) => void
  myId?: number
  reply?: boolean
}) {
  return (
    <div className={cn("flex gap-3.5", reply ? "mt-3 rounded-xl bg-white/4 p-3" : "border-b border-white/8 py-4")}>
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-white/30 text-[13px] font-semibold" style={{ background: c.color }}>
        {c.initials}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold">{c.name}</span>
          {c.staff && <span className="rounded-full bg-dp-orange px-2 py-px text-[11px] font-semibold text-white">Equipe Dopanima</span>}
          <span className="text-xs text-[#9C8AA6]">{c.time}</span>
        </div>
        {/* Texto puro: o React escapa o conteúdo, nenhum HTML de leitor é interpretado. */}
        <p className="m-0 text-[15px] leading-[1.6] wrap-anywhere whitespace-pre-wrap text-dp-body">{c.content}</p>
        <div className="mt-0.5 flex gap-4">
          {onReply && (
            <button onClick={() => onReply(c)} className="cursor-pointer py-1 text-xs font-semibold text-dp-muted hover:text-dp-yellow">
              Responder
            </button>
          )}
          {myId != null && c.userId === myId && (
            <button onClick={() => onDelete(c)} className="cursor-pointer py-1 text-xs font-semibold text-[#FF8A73]">
              Excluir
            </button>
          )}
        </div>
        {c.replies?.map((r) => <CommentItem key={r.id} c={r} reply onDelete={onDelete} myId={myId} />)}
      </div>
    </div>
  )
}

/** Comentários do post. Ler é livre; comentar exige conta no blog. */
export function PostComments({ slug }: { slug: string }) {
  const user = useSiteUser()
  const [comments, setComments] = useState<PublicComment[]>([])
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState("")
  const [website, setWebsite] = useState("")
  const [err, setErr] = useState("")
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState("")
  const textRef = useRef<HTMLTextAreaElement>(null)
  const path = `/api/public/posts/${encodeURIComponent(slug)}/comments`
  const back = encodeURIComponent(`/post/${slug}#h-coms`)

  const load = useCallback(async () => {
    try {
      const res = await fetch(API_URL + path)
      if (res.ok) setComments(await res.json())
    } catch {}
    setLoaded(true)
  }, [path])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch from the API; state is set after it resolves
    void load()
  }, [load])

  const total = comments.reduce((a, c) => a + 1 + (c.replies?.length ?? 0), 0)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    const t = text.trim()
    if (t.length < 3) return setErr("Escreva um comentário com pelo menos 3 caracteres.")
    setSending(true)
    try {
      // Vai com o cookie da conta: nome e e-mail vêm do cadastro.
      const data = await api.post<{ status: string }>(path, { content: t, website })
      setText("")
      setErr("")
      if (data.status === "approved") {
        toast.success("Comentário publicado")
        await load()
      } else {
        setNotice("Recebemos seu comentário! Ele aparece aqui assim que for aprovado pela moderação.")
      }
    } catch (e) {
      setErr(errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  const remove = async (c: PublicComment) => {
    if (!window.confirm("Excluir seu comentário?")) return
    try {
      await api.del(`/api/public/me/comments/${c.id}`)
      toast.success("Comentário excluído")
      await load()
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const reply = (c: PublicComment) => {
    setText(`@${c.name.split(" ")[0]} `)
    setErr("")
    requestAnimationFrame(() => {
      const el = textRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  return (
    <section aria-labelledby="h-coms" className="mt-11 flex max-w-[720px] scroll-mt-24 flex-col gap-4.5">
      <h2 id="h-coms" className="m-0 text-2xl font-bold">
        Comentários <span className="font-medium text-dp-muted">({total})</span>
      </h2>

      {user === false ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/14 bg-white/3 p-4">
          <p className="m-0 text-sm text-dp-body">Entre na sua conta para comentar.</p>
          <div className="flex gap-2">
            <Link href={`/entrar?next=${back}`} className="grid h-10 place-items-center rounded-full bg-dp-orange px-6 text-xs font-semibold tracking-[0.08em] text-white uppercase no-underline">
              Entrar
            </Link>
            <Link href={`/entrar?criar=1&next=${back}`} className="grid h-10 place-items-center rounded-full border border-white/40 px-5 text-xs font-semibold text-white no-underline hover:border-dp-yellow hover:text-dp-yellow">
              Criar conta
            </Link>
          </div>
        </div>
      ) : user ? (
        <form onSubmit={submit} noValidate className="relative flex gap-3.5 rounded-2xl border border-white/14 bg-white/3 p-4">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-white/40 text-[13px] font-semibold" style={{ background: user.color }}>
            {user.initials}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <span className="text-xs text-dp-muted">
              Comentando como <b className="text-white">{user.name}</b>
            </span>
            {/* Isca para robôs: escondida de pessoas e de leitores de tela. */}
            <input value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setErr("")
                setNotice("")
              }}
              rows={3}
              maxLength={MAX_TEXT}
              placeholder="O que você achou deste post?"
              aria-label="Seu comentário"
              className={cn(fieldCls, "min-h-22.5 resize-y py-3 leading-[1.6]")}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#9C8AA6]">{MAX_TEXT - text.length} caracteres restantes</span>
              <button
                type="submit"
                disabled={sending}
                className="h-10 cursor-pointer rounded-full bg-dp-orange px-7 text-xs font-semibold tracking-[0.08em] text-white uppercase transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-70"
              >
                {sending ? "Enviando..." : "Comentar"}
              </button>
            </div>
            {err && <span role="alert" className="text-xs text-dp-yellow">{err}</span>}
            {notice && <span role="status" className="text-xs text-dp-green">{notice}</span>}
          </div>
        </form>
      ) : null}

      <div className="flex flex-col">
        {comments.map((c) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <CommentItem c={c} onReply={user ? reply : undefined} onDelete={remove} myId={user ? user.id : undefined} />
          </motion.div>
        ))}
        {loaded && !comments.length && <p className="m-0 text-sm text-dp-muted">Seja a primeira pessoa a comentar.</p>}
      </div>
    </section>
  )
}
