import sanitizeHtml from "sanitize-html"

// Tags e atributos que o editor do painel produz. Todo HTML de post passa por aqui
// antes de ser salvo, então a página pública pode renderizá-lo com segurança.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "p", "br", "hr", "blockquote", "pre", "code",
    "strong", "b", "em", "i", "u", "s", "strike", "del", "span", "div",
    "ul", "ol", "li", "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel", "data-btn"],
    img: ["src", "alt", "title", "width", "height"],
    ul: ["data-check"],
    p: ["data-embed"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tag, attribs) =>
      attribs.target === "_blank" ? { tagName: tag, attribs: { ...attribs, rel: "noopener noreferrer" } } : { tagName: tag, attribs },
  },
}

export const sanitize = (html: string) => sanitizeHtml(html || "", OPTIONS)

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" }

export const stripTags = (html: string) =>
  (html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|tr|div)>/gi, "$&\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m])

export const words = (text: string) => text.trim().split(/\s+/).filter(Boolean)

export const wordCount = (html: string) => words(stripTags(html)).length

/** Tempo de leitura a ~200 palavras por minuto. */
export const readTime = (html: string) => `${Math.max(1, Math.round(wordCount(html) / 200))} min`
