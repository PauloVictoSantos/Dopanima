// Valores aceitos nos campos-texto do banco e a matriz de permissões por função.

export const POST_STATUSES = ["draft", "review", "scheduled", "published", "archived", "trash"] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const ROLES = ["super_admin", "editor", "author", "reviewer", "contributor", "reader"] as const
export type Role = (typeof ROLES)[number]

export const USER_STATUSES = ["active", "pending", "suspended"] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const MEDIA_TYPES = ["image", "video", "audio", "document"] as const
export type MediaType = (typeof MEDIA_TYPES)[number]

export const PERMISSIONS = [
  "create", "editOwn", "editAll", "publish", "schedule", "delete",
  "taxonomy", "media", "moderate", "users", "seo", "analytics", "settings",
] as const
export type Permission = (typeof PERMISSIONS)[number]

const ALL = [...PERMISSIONS]
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: ALL,
  editor: ALL.filter((p) => p !== "users" && p !== "settings"),
  author: ["create", "editOwn", "publish", "schedule", "media", "analytics"],
  reviewer: ["editAll", "moderate", "analytics"],
  contributor: ["create", "editOwn"],
  reader: [],
}

export const can = (role: string, perm: Permission) => (ROLE_PERMISSIONS[role as Role] ?? []).includes(perm)

/**
 * Tipo público do post ("filme", "livro"...) pelo slug da categoria principal.
 * O frontend usa esse tipo para cores, cards e seções da home.
 */
export const CATEGORY_TYPE: Record<string, "filme" | "livro" | "serie" | "noticia"> = {
  filmes: "filme",
  livros: "livro",
  series: "serie",
  noticias: "noticia",
}

export const USER_COLORS = ["#5A0F6E", "#B5179E", "#7A2E8E", "#3B0A45", "#7A1F3D", "#26113A"]
