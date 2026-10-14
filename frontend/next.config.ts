import type { NextConfig } from "next"

const API_URL = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333").replace(/\/$/, "")
const isProd = process.env.NODE_ENV === "production"
// Origem da API vista pelo navegador (fetch do painel, imagens e vídeos de /uploads).
const PUBLIC_API = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333").origin
  } catch {
    return ""
  }
})()

/**
 * CSP completa em modo "Report-Only": o navegador só avisa no console o que seria bloqueado.
 * Depois de navegar pelo site e pelo painel sem avisos, troque a chave para
 * "Content-Security-Policy" para passar a bloquear de fato.
 * 'unsafe-inline' em script-src: o Next injeta scripts inline de hidratação (sem nonce).
 */
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Capas da TMDB/Google Books e fotos de perfil vêm de outros domínios https.
  `img-src 'self' data: blob: https: ${PUBLIC_API}`,
  "font-src 'self' data:",
  `connect-src 'self' ${PUBLIC_API}`,
  `media-src 'self' ${PUBLIC_API}`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

// Cabeçalhos de segurança para todas as páginas do site e do painel.
const securityHeaders = [
  // Ninguém pode exibir o site dentro de um iframe (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd
    ? [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
      ]
    : []),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // O painel e o login nunca vão para cache compartilhado nem para buscadores.
      { source: "/(painel|login)(.*)", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ]
  },
  // sitemap.xml e robots.txt são gerados pelo backend a partir dos posts e das configurações de SEO.
  async rewrites() {
    return [
      { source: "/sitemap.xml", destination: `${API_URL}/sitemap.xml` },
      { source: "/robots.txt", destination: `${API_URL}/robots.txt` },
    ]
  },
}

export default nextConfig
