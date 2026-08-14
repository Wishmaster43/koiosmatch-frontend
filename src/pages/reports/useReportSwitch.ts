/**
 * useReportSwitch — URL-synced switch-position state for a merged report page
 * (RAPPORTEN-CONSOLIDATIE-1). Mirrors `useDrawerUrl`'s hash-query pattern: the
 * active position lives in `?view=<position>` on the page's own hash
 * (`#reports.candidates?view=leads`), so a link to one switch position opens
 * directly on it, survives reload, and can be shared (Danny: "de keuze staat in
 * de URL"). Unlike `useDrawerUrl` (push per open/close), flipping the switch
 * REPLACES the history entry — toggling Kandidaten/Leads a few times must not
 * spam the back-button stack, mirroring useDrawerUrl's own tab-only-change rule.
 *
 * `initial` seeds the position on mount (and re-seeds if it changes while the
 * SAME merged page stays mounted — e.g. a legacy alias route like
 * `reports.leads` swapping to the canonical `reports.candidates` without an
 * unmount, since both render the exact same top-level component for reportId
 * 'candidates'). A `?view=` already in the URL always wins over `initial`, so a
 * pasted deep link is never silently overridden by the route's own default.
 */
import { useEffect, useRef, useState } from 'react'

// Pure: read `view` out of a hash string (no window access — testable, mirrors
// useDrawerUrl's getOpenIdFromHash).
export function getViewFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  if (qIdx === -1) return null
  return new URLSearchParams(raw.slice(qIdx + 1)).get('view')
}

// Pure: rewrite a hash string's `view` param, keeping everything else untouched.
export function setViewInHash(hash: string, view: string | null): string {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  const path = qIdx === -1 ? raw : raw.slice(0, qIdx)
  const params = new URLSearchParams(qIdx === -1 ? '' : raw.slice(qIdx + 1))
  if (view != null) params.set('view', view)
  else params.delete('view')
  const query = params.toString()
  return `#${path}${query ? `?${query}` : ''}`
}

// Resolve the starting position: the URL wins when it names a valid position,
// otherwise the caller's own default for this route.
function resolveInitial(positions: readonly string[], fallback: string): string {
  const fromUrl = getViewFromHash(window.location.hash)
  return fromUrl && positions.includes(fromUrl) ? fromUrl : fallback
}

export function useReportSwitch(positions: readonly string[], initial: string) {
  const [position, setPositionState] = useState<string>(() => resolveInitial(positions, initial))

  // Re-seed when `initial` changes without an unmount (legacy alias → canonical
  // route on the same mounted component — see file comment).
  const seeded = useRef(initial)
  useEffect(() => {
    if (seeded.current !== initial) {
      seeded.current = initial
      setPositionState(resolveInitial(positions, initial))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- positions is a stable literal tuple per caller
  }, [initial])

  // Interactive switch: update state + replace the URL's `view` param so the
  // current position is always the shareable/reloadable one.
  const setPosition = (next: string) => {
    setPositionState(next)
    window.history.replaceState(window.history.state, '', setViewInHash(window.location.hash, next))
  }

  // Back/forward: pick up a `view` change from history navigation.
  useEffect(() => {
    const onPop = () => {
      const fromUrl = getViewFromHash(window.location.hash)
      if (fromUrl && positions.includes(fromUrl)) setPositionState(fromUrl)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- positions is a stable literal tuple per caller
  }, [])

  return [position, setPosition] as const
}
