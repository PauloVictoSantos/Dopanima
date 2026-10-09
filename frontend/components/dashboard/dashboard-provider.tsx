"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { errorMessage } from "@/lib/api"
import {
  categoriesApi, commentsApi, mediaApi, postsApi, tagsApi, toCategory, toDashPost, toMediaItem, usersApi, type Author,
} from "@/lib/dashboard-api"
import {
  SEED_PROFILE,
  SEED_SETTINGS,
  SEED_NOTIFS,
  SEED_NOTIF_PREFS,
  SEED_PERMS,
  SEED_TEAM,
  type Category,
  type DashNotif,
  type NotifPrefs,
  type PermMatrix,
  type TeamMember,
  type DashPost,
  type MediaItem,
  type PostStatus,
  type Profile,
  type Settings,
  type TagItem,
} from "@/lib/dashboard"
import { refreshSession, useSession, type Me } from "@/lib/session"

type Setter<T> = React.Dispatch<React.SetStateAction<T>>

type DashboardState = {
  /** Signed-in user from the API (null while loading). */
  me: Me | null
  can: (perm: string) => boolean
  /** True until the first load from the API finishes. */
  loading: boolean
  posts: DashPost[]
  reloadPosts: () => Promise<void>
  cats: Category[]
  reloadCats: () => Promise<void>
  tags: TagItem[]
  reloadTags: () => Promise<void>
  media: MediaItem[]
  reloadMedia: () => Promise<void>
  authors: Author[]
  reloadMe: () => Promise<void>
  /** Comentários aguardando moderação (badge do menu). */
  pendingCount: number
  reloadPending: () => Promise<void>
  profile: Profile
  setProfile: Setter<Profile>
  settings: Settings
  setSettings: Setter<Settings>
  notifs: DashNotif[]
  setNotifs: Setter<DashNotif[]>
  unreadCount: number
  notifPrefs: NotifPrefs
  setNotifPrefs: Setter<NotifPrefs>
  perms: PermMatrix
  setPerms: Setter<PermMatrix>
  team: TeamMember[]
  setTeam: Setter<TeamMember[]>
  /** Header search: filters the overview table, or the posts list elsewhere. */
  overviewQuery: string
  setOverviewQuery: (q: string) => void
  postsQuery: string
  setPostsQuery: (q: string) => void
  postsStatus: PostStatus | "Todos"
  setPostsStatus: (s: PostStatus | "Todos") => void
}

const DashboardContext = createContext<DashboardState | null>(null)

// Posts, categories, tags, media, comments and the signed-in user come from the API.
// Notifications, the permissions screen and site settings are still in-memory demo state.
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const me = session || null
  const signedIn = !!session && !session.mustChangePassword
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<DashPost[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [tags, setTags] = useState<TagItem[]>([])
  const [media, setMedia] = useState<MediaItem[]>([])
  const [authors, setAuthors] = useState<Author[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [profile, setProfile] = useState(SEED_PROFILE)
  const [settings, setSettings] = useState(SEED_SETTINGS)
  const [notifs, setNotifs] = useState(SEED_NOTIFS)
  const [notifPrefs, setNotifPrefs] = useState(SEED_NOTIF_PREFS)
  const [perms, setPerms] = useState(SEED_PERMS)
  const [team, setTeam] = useState(SEED_TEAM)
  const [overviewQuery, setOverviewQuery] = useState("")
  const [postsQuery, setPostsQuery] = useState("")
  const [postsStatus, setPostsStatus] = useState<PostStatus | "Todos">("Todos")

  const reloadPosts = useCallback(async () => setPosts((await postsApi.list({ status: "all", pageSize: 500 })).items.map(toDashPost)), [])
  const reloadCats = useCallback(async () => setCats((await categoriesApi.list()).map(toCategory)), [])
  const reloadTags = useCallback(async () => setTags(await tagsApi.list()), [])
  const reloadMedia = useCallback(async () => setMedia((await mediaApi.list()).items.map(toMediaItem)), [])
  const reloadMe = useCallback(async () => {
    await refreshSession()
  }, [])
  const reloadPending = useCallback(async () => {
    if (!me?.permissions.includes("moderate")) return
    setPendingCount((await commentsApi.list({ status: "pending" })).counts.pending)
  }, [me])

  // Profile header (name, photo) mirrors the signed-in user.
  const meKey = me ? `${me.id}:${me.name}:${me.email}:${me.avatarUrl}` : ""
  useEffect(() => {
    if (!me) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the session user into the profile form
    setProfile((p) => ({ ...p, name: me.name, email: me.email, bio: me.bio, photo: me.avatarUrl }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meKey captures the fields we copy
  }, [meKey])

  useEffect(() => {
    if (!signedIn) return
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load from the API once signed in; state is set after the requests resolve
    Promise.allSettled([reloadPosts(), reloadCats(), reloadTags(), reloadMedia(), reloadPending(), usersApi.authors().then(setAuthors)]).then((results) => {
      if (!alive) return
      const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected")
      if (failed) toast.error(errorMessage(failed.reason))
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [signedIn, reloadPosts, reloadCats, reloadTags, reloadMedia, reloadPending])

  const can = useCallback((perm: string) => !!me?.permissions.includes(perm), [me])

  const unreadCount = notifs.filter((n) => n.unread).length

  const value = useMemo(
    () => ({
      me, can, loading,
      posts, reloadPosts,
      cats, reloadCats,
      tags, reloadTags,
      media, reloadMedia,
      authors, reloadMe,
      pendingCount, reloadPending,
      profile, setProfile,
      settings, setSettings,
      notifs, setNotifs, unreadCount,
      notifPrefs, setNotifPrefs,
      perms, setPerms,
      team, setTeam,
      overviewQuery, setOverviewQuery,
      postsQuery, setPostsQuery,
      postsStatus, setPostsStatus,
    }),
    [me, can, loading, posts, reloadPosts, cats, reloadCats, tags, reloadTags, media, reloadMedia, authors, reloadMe, pendingCount, reloadPending, profile, settings, notifs, unreadCount, notifPrefs, perms, team, overviewQuery, postsQuery, postsStatus]
  )
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error("useDashboard must be used inside <DashboardProvider>")
  return ctx
}
