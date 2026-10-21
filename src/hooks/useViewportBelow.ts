import { useEffect, useState } from 'react'

/**
 * useViewportBelow (§6) — true while the viewport is narrower than `px`. Mirrors
 * usePrefersReducedMotion: guarded for jsdom/older browsers without matchMedia and
 * subscribed live, so resizing the window updates the result without a reload.
 */
export function useViewportBelow(px: number): boolean {
  const query = `(max-width: ${px - 1}px)`
  const [below, setBelow] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  })

  // Subscribe to viewport changes; no-ops where matchMedia is unavailable.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const onChange = () => setBelow(mq.matches)
    setBelow(mq.matches)
    if (typeof mq.addEventListener !== 'function') return
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return below
}
