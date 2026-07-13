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

// Pure: decide push vs replace for a state→URL write — see the file comment.
export function resolveWriteMode(curId: string | null, intentOpenId: Id | null | undefined): 'push' | 'replace' {
  return curId != null && intentOpenId != null && String(intentOpenId) === curId ? 'replace' : 'push'
}

// Impure wrappers around the pure helpers above — the only spots touching `window`.
const readOpenId = (): string | null => getOpenIdFromHash(window.location.hash)
const writeOpenId = (id: string | null, push: boolean) => {
  const next = setOpenIdInHash(window.location.hash, id)
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
}

// Bi-directional sync between `selectedId` (React state) and the URL's `open`
// param. `lastSynced` is the single source of truth for "what did we last agree
// with the URL" — comparing against it (not re-deriving from scratch) is the
// echo guard: it stops a URL-driven write from re-triggering a state-driven
// write, and vice versa, so the two effects below never loop.
export function useDrawerUrl({ selectedId, openById, close, intent }: UseDrawerUrlArgs) {
  // Seeded from the incoming state, NOT the URL: a deep-linked `?open=<id>` must
  // still trigger the URL→state effect below to actually call `openById` — if
  // this started from the URL instead, a fresh mount would see them "already
  // equal" and skip opening the record it was supposed to restore.
  const lastSynced = useRef<string | null>(selectedId != null ? String(selectedId) : null)
  // Refs must not be written during render (react-hooks/refs) — kept current via
  // its own effect below so the popstate handler can read the latest value.
  const selectedIdRef = useRef(selectedId)
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  // React state → URL: the user opened/closed/switched the drawer in this page.
  useEffect(() => {
    const curId = selectedId != null ? String(selectedId) : null
    if (curId === lastSynced.current) return
    const intentOpenId = (intent as { open?: Id } | null | undefined)?.open
    writeOpenId(curId, resolveWriteMode(curId, intentOpenId) === 'push')
    lastSynced.current = curId
  }, [selectedId, intent])

  // URL → React state: back/forward, plus once on mount — covers a fresh deep
  // link (?open=<id> pasted in a new tab) and a page that remounted because
  // "back" landed on it with its own `?open=` still set (source-page restore).
  useEffect(() => {
    const sync = () => {
      const urlId = readOpenId()
      if (urlId === lastSynced.current) return
      lastSynced.current = urlId
      const curId = selectedIdRef.current != null ? String(selectedIdRef.current) : null
      if (urlId === curId) return // already showing the right record
      if (urlId != null) openById(urlId)
      else close()
    }
    sync()
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
