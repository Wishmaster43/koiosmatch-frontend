/**
 * useAppNavigation: active page + navigation intent + back-chip origin of the app shell,
 * wired to real browser history so back/forward switch between pages.
 */
import { useState, useEffect } from 'react'
import { PAGE_TITLES } from './appPages'

// Owns the page state and the history plumbing; the shell only renders what it returns.
export function useAppNavigation({ defaultPage }: { defaultPage: string }) {
  // Boot from the URL hash when it names a known page (deep-link/refresh survive);
  // Settings rewrites the hash to its own sections, so unknown hashes fall back.
  // Split on '/' (legacy sub-path) AND '?' (NAV-BACK-1's `?open=<id>` drawer param)
  // so a deep-linked drawer URL still resolves to its page, not the fallback.
  const [activePage,     setActivePage]     = useState(() => {
    const fromHash = window.location.hash.replace(/^#/, '').split(/[/?]/)[0]
    return (fromHash && PAGE_TITLES[fromHash]) ? fromHash : defaultPage
  })
  // Navigation intent: a filter the target page should apply when navigated to
  // (e.g. a dashboard KPI/chart click). Plain navigation (sidebar) clears it.
  const [navIntent,      setNavIntent]      = useState<unknown>(null)
  // Every page switch becomes a real history entry, so the browser's back/forward
  // work (Danny 2026-07-05: "terug in de browser doet niks").
  // A jump WITH an intent (KPI/doorklik) remembers where it came from → back-chip;
  // plain navigation (sidebar) clears it.
  const [jumpOrigin, setJumpOrigin] = useState<string | null>(null)
  // Navigates to a page: pushes a real history entry (so browser back/forward work)
  // and remembers where a KPI/doorklik jump came from for the back-chip.
  const goTo = (page: string, intent: unknown = null) => {
    setJumpOrigin(intent != null && page !== activePage ? activePage : null)
    setNavIntent(intent); setActivePage(page)
    window.history.pushState({ kmPage: page }, '', `#${page}`)
    // Synthetic popstate: pushState is silent, and hash-derived listeners
    // (Koios ambient chip) must see a page switch drop the open record.
    window.dispatchEvent(new PopStateEvent('popstate', { state: { kmPage: page, kmSynthetic: true } }))
  }
  // Back/forward: restore the page from our history state (hash as reload fallback).
  // Same '/'+'?' split as above — a NAV-BACK-1 drawer entry's `kmPage` is already
  // the bare page (see useDrawerUrl), but the hash fallback still carries `?open=`.
  // MATCH-APPROVAL-2: notification events (synthetic popstate with kmIntentData)
  // communicate a custom intent to the target page.
  useEffect(() => {
    // User pressed browser back/forward: resolve the target page from the pushed
    // history state, falling back to the hash for a hard reload.
    const onPop = (e: PopStateEvent) => {
      const state = e.state as { kmSynthetic?: boolean; kmPage?: string; kmIntentData?: unknown } | null
      // MATCH-APPROVAL-2: notification navigation carries kmIntentData in synthetic events.
      // Apply it as navIntent so the target page receives it via the intent prop.
      if (state?.kmSynthetic && state?.kmIntentData != null) {
        setNavIntent(state.kmIntentData)
        // Same guard as the fall-through path: only a known page id becomes the active page.
        const intentPage = state.kmPage ?? window.location.hash.replace(/^#/, '').split(/[/?]/)[0]
        if (intentPage && PAGE_TITLES[intentPage]) setActivePage(intentPage)
        return
      }
      // Synthetic announcements (kmSynthetic) are for hash-derived listeners
      // only — they are not user navigation, so never reset intent on them.
      if (state?.kmSynthetic) return
      const page = state?.kmPage ?? window.location.hash.replace(/^#/, '').split(/[/?]/)[0]
      if (page && PAGE_TITLES[page]) { setNavIntent(null); setActivePage(page) }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return { activePage, navIntent, jumpOrigin, goTo }
}
