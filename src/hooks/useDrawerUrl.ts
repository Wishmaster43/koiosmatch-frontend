/**
 * useDrawerUrl — mirrors an entity page's open-drawer id in the URL hash's query
 * string (`?open=<id>`), so browser back/forward walks through drawer open/close
 * states and a copied URL reopens the same record (NAV-BACK-1, Danny: "back knop
 * vanuit kans → taak en dan back in browser kom ik niet terug waar ik was").
 *
 * The app routes pages via a hand-rolled hash history (DashboardLayout's own
 * goTo/popstate handling — see appPages.tsx), not react-router's <Route>-per-page
 * location, so this hook reads/writes `window.location.hash` directly instead of
 * react-router's useSearchParams. It only ever touches the query portion after
 * `?`; the page-path portion before it is left untouched, so the same hook works
 * unchanged under whichever page currently owns the hash.
 *
 * Choice: OPENING and CLOSING both PUSH a history entry (so back steps through
 * open → closed → open, like a normal page). The one exception is the very first
 * open caused by a cross-entity `{ open: id }` navigation intent — that REPLACEs
 * the entry the page-switch itself just pushed, otherwise every cross-entity jump
 * would stack two entries (bare page + its opened id) for what feels like one
 * action, and a single "back" would only strip the id instead of returning to
 * the previous page.
 *
 * GONE-BANNER-1 (2026-08-13): a stale `?open=<dead-id>` must never survive a
 * close, or pressing back re-lands on it and re-triggers the "record gone"
 * fetch/banner. The normal close still PUSHES (NAV-BACK-1 above stays intact —
 * closing is a real back-button stop). The one exception is `markNextCloseReplace()`,
 * used EXCLUSIVELY by a "this record no longer exists" close: it REPLACEs the
 * dead `?open=<id>` entry instead of pushing past it, so back skips straight
 * over the id that no longer resolves.
 *
 * SUB-TAB (NOTITIE-POPOUT-1 F5): `tab`/`setTab` are OPTIONAL and BACKWARD-
 * COMPATIBLE — every existing caller omits them and behaves exactly as before.
 * When supplied, the hook also mirrors the drawer's active sub-tab in `&tab=<id>`
 * ALONGSIDE `open` (never on its own — a `tab` with no open id is meaningless and
 * gets dropped), so a deep link like `?open=<id>&tab=notes` can reopen a drawer
 * straight onto one sub-tab (first use: the notes second-screen popout). A
 * tab-only change (the record stays open, only the sub-tab switches) REPLACES
 * rather than pushes — switching tabs must never spam the back-button history;
 * only opening/closing a record does that.
 */
import { useEffect, useRef } from 'react'
import type { Id } from '@/types/common'

// Pure: read the `open` param out of a hash string (no window access — testable).
export function getOpenIdFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  if (qIdx === -1) return null
  return new URLSearchParams(raw.slice(qIdx + 1)).get('open')
}

// Pure: rewrite a hash string's `open` param, keeping its page-path untouched.
export function setOpenIdInHash(hash: string, id: string | null): string {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  const path = qIdx === -1 ? raw : raw.slice(0, qIdx)
  const params = new URLSearchParams(qIdx === -1 ? '' : raw.slice(qIdx + 1))
  if (id != null) params.set('open', id)
  else params.delete('open')
  const query = params.toString()
  return `#${path}${query ? `?${query}` : ''}`
}

// Pure: read the `tab` param out of a hash string — mirrors getOpenIdFromHash
// (NOTITIE-POPOUT-1 F5's sub-tab deep-link, see the file comment).
export function getTabFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  if (qIdx === -1) return null
  return new URLSearchParams(raw.slice(qIdx + 1)).get('tab')
}

// Pure: rewrite a hash string's `tab` param, keeping everything else untouched —
// mirrors setOpenIdInHash.
export function setTabInHash(hash: string, tab: string | null): string {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  const path = qIdx === -1 ? raw : raw.slice(0, qIdx)
  const params = new URLSearchParams(qIdx === -1 ? '' : raw.slice(qIdx + 1))
  if (tab != null) params.set('tab', tab)
  else params.delete('tab')
  const query = params.toString()
  return `#${path}${query ? `?${query}` : ''}`
}

// Pure: decide push vs replace for a state→URL write — see the file comment.
export function resolveWriteMode(curId: string | null, intentOpenId: Id | null | undefined): 'push' | 'replace' {
  return curId != null && intentOpenId != null && String(intentOpenId) === curId ? 'replace' : 'push'
}

// Impure wrappers around the pure helpers above — the only spots touching `window`.
const readOpenId = (): string | null => getOpenIdFromHash(window.location.hash)
const readTab = (): string | null => getTabFromHash(window.location.hash)
// `tab` rides ALONGSIDE `id` in one write: null id always forces tab to null too
// (closing a drawer must never strand a `tab=` param), regardless of what the
// caller's own tab state still holds (NOTITIE-POPOUT-1 F5 — see the file comment).
const writeOpenId = (id: string | null, tab: string | null, push: boolean) => {
  let next = setOpenIdInHash(window.location.hash, id)
  next = setTabInHash(next, id != null ? tab : null)
  // `kmPage` mirrors DashboardLayout's own history state shape (see goTo) so its
  // popstate handler can read the page name straight from state, same as a
  // page-switch entry, instead of only via the hash-parsing fallback.
  const path = window.location.hash.replace(/^#/, '').split(/[/?]/)[0]
  const state = { kmPage: path, drawerOpen: id }
  if (push) window.history.pushState(state, '', next)
  else window.history.replaceState(state, '', next)
}

export interface UseDrawerUrlArgs {
  // The page's own "which record is open" id — usually `selected?.id`.
  selectedId: Id | null | undefined
  // The page's own "open this record" function (e.g. `selectCandidate`, or
  // `setPendingOpenId` for pages that defer until the row is loaded — Matches).
  openById: (id: Id) => void
  // The page's own "close the drawer" function.
  close: () => void
  // The page's own navigation intent (a cross-entity `{ open: id }` jump), if
  // any — lets the hook tell that first, automatic open apart from an
  // interactive one (see the push-vs-replace choice above).
  intent?: unknown
  // NOTITIE-POPOUT-1 F5, both OPTIONAL — the page's own "active sub-tab" state +
  // setter. Omitted (every existing caller) → behaves exactly as before; supplied
  // → the sub-tab mirrors into `&tab=<id>` alongside `open` (see file comment).
  tab?: string | null
  setTab?: (tab: string | null) => void
}

// Bi-directional sync between `selectedId`/`tab` (React state) and the URL's
// `open`/`tab` params. `lastSynced`/`lastSyncedTab` are the single source of truth
// for "what did we last agree with the URL" — comparing against them (not
// re-deriving from scratch) is the echo guard: it stops a URL-driven write from
// re-triggering a state-driven write, and vice versa, so the effects below never loop.
export function useDrawerUrl({ selectedId, openById, close, intent, tab, setTab }: UseDrawerUrlArgs) {
  // Seeded from the incoming state, NOT the URL: a deep-linked `?open=<id>` must
  // still trigger the URL→state effect below to actually call `openById` — if
  // this started from the URL instead, a fresh mount would see them "already
  // equal" and skip opening the record it was supposed to restore.
  const lastSynced = useRef<string | null>(selectedId != null ? String(selectedId) : null)
  const lastSyncedTab = useRef<string | null>(tab ?? null)
  // Refs must not be written during render (react-hooks/refs) — kept current via
  // its own effect below so the popstate handler can read the latest value.
  const selectedIdRef = useRef(selectedId)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  const tabRef = useRef(tab)
  useEffect(() => { tabRef.current = tab }, [tab])
  // GONE-BANNER-1: one-shot flag consumed by the very next close write below —
  // set synchronously (refs update immediately, unlike state) right before the
  // caller flips `selectedId` to null, so the write effect sees it in time.
  const nextCloseModeRef = useRef<'push' | 'replace'>('push')

  // React state → URL: the user opened/closed/switched the drawer, OR (F5) only
  // switched its sub-tab, in this page. A tab-only change (id unchanged) always
  // REPLACES — only an id change ever pushes a new back-button stop, mirroring
  // the existing push/replace choice for `open` alone.
  useEffect(() => {
    const curId = selectedId != null ? String(selectedId) : null
    const curTab = curId != null ? (tab ?? null) : null
    if (curId === lastSynced.current && curTab === lastSyncedTab.current) return
    const idChanged = curId !== lastSynced.current
    const intentOpenId = (intent as { open?: Id } | null | undefined)?.open
    // GONE-BANNER-1: a close (curId null) honours the one-shot replace flag
    // instead of the normal push-on-close default; consumed once then reset.
    let push: boolean
    if (idChanged && curId == null) {
      push = nextCloseModeRef.current === 'push'
      nextCloseModeRef.current = 'push'
    } else {
      push = idChanged && resolveWriteMode(curId, intentOpenId) === 'push'
    }
    writeOpenId(curId, curTab, push)
    lastSynced.current = curId
    lastSyncedTab.current = curTab
  }, [selectedId, tab, intent])

  // URL → React state: back/forward, plus once on mount — covers a fresh deep
  // link (?open=<id>&tab=<tab> pasted in a new tab, F5's second-screen popout) and
  // a page that remounted because "back" landed on it with its own `?open=` still
  // set (source-page restore). Tab is read/applied alongside id, but a tab-only
  // URL difference (id already correct) still calls `setTab` on its own.
  useEffect(() => {
    const sync = () => {
      const urlId = readOpenId()
      const urlTab = readTab()
      if (urlId === lastSynced.current && urlTab === lastSyncedTab.current) return
      lastSynced.current = urlId
      lastSyncedTab.current = urlTab
      const curId = selectedIdRef.current != null ? String(selectedIdRef.current) : null
      const curTab = tabRef.current ?? null
      if (urlId === curId && urlTab === curTab) return // already showing the right record+tab
      if (urlId != null) {
        if (urlId !== curId) openById(urlId)
        setTab?.(urlTab)
      } else {
        close()
        setTab?.(null)
      }
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // GONE-BANNER-1: call right before the next close (`selectedId` → null) to make
  // that one close REPLACE the current `?open=<id>` entry instead of pushing past
  // it — see the file comment. Any close that does NOT call this still pushes.
  const markNextCloseReplace = () => { nextCloseModeRef.current = 'replace' }
  return { markNextCloseReplace }
}
