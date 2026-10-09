"use client"

import { toast } from "sonner"
import { useDashboard } from "@/components/dashboard/dashboard-provider"
import { Field, PageHeading, PageMain, Panel, SwitchRow, btnPrimary, inputCls, selectCls } from "@/components/dashboard/ui"
import { TIMEZONES, type Settings } from "@/lib/dashboard"

type TextKey = "siteName" | "tagline" | "url" | "perPage" | "metaTpl" | "metaDesc" | "ogImg"
type FlagKey = "index" | "sitemap" | "comments" | "newsletter" | "related" | "readTime" | "twofa" | "maint"

export function SettingsView() {
  const { settings: c, setSettings } = useDashboard()
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }))

  const field = (key: TextKey, label: string, type = "text", ph = "") => (
    <Field key={key} label={label}>
      <input type={type} value={c[key]} onChange={(e) => set(key, e.target.value)} placeholder={ph} className={inputCls} />
    </Field>
  )
  const flag = (key: FlagKey, label: string, desc: string, divider = true) => (
    <SwitchRow key={key} label={label} desc={desc} on={c[key]} onToggle={() => set(key, !c[key])} divider={divider} />
  )

  return (
    <PageMain className="max-w-300">
      <PageHeading eyebrow="Sistema" title="Configurações">
        <button onClick={() => toast.success("Configurações salvas")} className={btnPrimary + " px-6"}>Salvar alterações</button>
      </PageHeading>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-4">
        <Panel className="gap-3">
          <h2 className="m-0 text-base font-semibold">Geral</h2>
          {field("siteName", "Nome do site")}
          {field("tagline", "Slogan")}
          {field("url", "Endereço do site", "url")}
          {field("perPage", "Posts por página", "number")}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fuso horário">
              <select value={c.tz} onChange={(e) => set("tz", e.target.value)} className={selectCls}>
                {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Idioma">
              <select value={c.lang} onChange={(e) => set("lang", e.target.value)} className={selectCls}>
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </Field>
          </div>
        </Panel>

        <Panel className="gap-3">
          <h2 className="m-0 text-base font-semibold">SEO padrão</h2>
          {field("metaTpl", "Modelo de meta title", "text", "%titulo% | Dopanima")}
          {field("metaDesc", "Meta description padrão")}
          {field("ogImg", "Imagem Open Graph padrão (URL)", "url")}
          {flag("index", "Permitir indexação", "Desligue para esconder o site do Google", false)}
          {flag("sitemap", "Gerar sitemap.xml", "Atualizado a cada publicação", false)}
        </Panel>

        <Panel className="gap-1">
          <h2 className="m-0 mb-1.5 text-base font-semibold">Leitura e engajamento</h2>
          {flag("comments", "Comentários nos posts", "Leitores podem comentar")}
          {flag("newsletter", "Formulário de newsletter", 'Exibe a faixa "Receba os posts no seu e-mail"')}
          {flag("related", "Posts relacionados", "Mostra 3 sugestões no fim do post")}
          {flag("readTime", "Tempo de leitura", "Exibe o tempo estimado em cada post")}
        </Panel>

        <Panel className="gap-1">
          <h2 className="m-0 mb-1.5 text-base font-semibold">Segurança</h2>
          {flag("twofa", "Verificação em duas etapas", "Exige código no login de administradores")}
          {flag("maint", "Modo manutenção", "Mostra uma página de aviso para os leitores")}
          <h3 className="mt-3 mb-1 text-[13px] font-semibold text-dp-muted">Sessões ativas</h3>
          {c.sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-semibold">{s.device}</span>
                <span className="text-xs text-dp-muted">{s.meta}</span>
              </span>
              {s.current ? (
                <span className="text-xs font-semibold text-dp-green">Este aparelho</span>
              ) : (
                <button
                  onClick={() => {
                    set("sessions", c.sessions.filter((x) => x.id !== s.id))
                    toast.success("Sessão encerrada")
                  }}
                  className="h-7.5 cursor-pointer rounded-full border border-[#FF8A73]/50 px-3 text-xs font-semibold text-[#FF8A73]"
                >
                  Encerrar
                </button>
              )}
            </div>
          ))}
        </Panel>
      </div>
    </PageMain>
  )
}
