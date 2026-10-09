import Link from "next/link"
import { Logo, MiniMascot } from "@/components/brand"
import { InstagramIcon, XIcon, YouTubeIcon } from "@/components/icons"

const COLUMNS = [
  { title: "Filmes", links: ["Resenhas", "Listas", "Bastidores"] },
  { title: "Livros", links: ["Resenhas", "Listas", "Trechos comentados"] },
  { title: "Notícias", links: ["Cinema", "Literatura", "Lançamentos"] },
]

const SOCIAL = [
  { label: "Instagram", Icon: InstagramIcon },
  { label: "X", Icon: XIcon },
  { label: "YouTube", Icon: YouTubeIcon },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-dp-deep">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-7 px-[clamp(16px,5vw,64px)] pt-12 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-[18px]">
            <Logo size={34} />
            <MiniMascot />
            <span className="max-w-[200px] text-[13px] text-dp-muted">Filmes, livros e notícias em um só lugar.</span>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="font-display text-xl text-dp-yellow">Siga a gente:</span>
            {SOCIAL.map(({ label, Icon }) => (
              <a key={label} href="#" aria-label={label} className="grid size-10 place-items-center rounded-full text-dp-yellow hover:bg-dp-yellow/12">
                <Icon />
              </a>
            ))}
          </div>
        </div>
        <div role="separator" className="h-px bg-white/14" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-8">
          {COLUMNS.map((c) => (
            <div key={c.title} className="flex flex-col gap-2.5">
              <h3 className="mb-1 font-display text-[22px] font-normal text-dp-yellow">{c.title}</h3>
              {c.links.map((l) => (
                <Link key={l} href="/" className="text-[13px] text-dp-muted hover:text-white">
                  {l}
                </Link>
              ))}
            </div>
          ))}
          <div className="flex flex-col gap-2.5">
            <h3 className="mb-1 font-display text-[22px] font-normal text-dp-yellow">Contato</h3>
            <a href="mailto:contato@dopanima.com" className="text-[13px] text-dp-muted hover:text-white">contato@dopanima.com</a>
            <Link href="/" className="text-[13px] text-dp-muted hover:text-white">Privacidade</Link>
            <Link href="/" className="text-[13px] text-dp-muted hover:text-white">Termos de uso</Link>
          </div>
        </div>
        <p className="mt-2 text-xs text-dp-muted">© 2026 Dopanima. Todo o conteúdo deste site é fictício.</p>
        {/* Crédito exigido pelos termos de uso da API da TMDB. */}
        <p className="mt-1 text-xs text-dp-muted">
          Dados e imagens de filmes e séries:{" "}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#01b4e4]">
            TMDB
          </a>
          . Este site usa a API da TMDB, mas não é endossado nem certificado pela TMDB.
        </p>
      </div>
    </footer>
  )
}
