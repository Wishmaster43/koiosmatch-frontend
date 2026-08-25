/**
 * usePrefersReducedMotion (§6) — THE one reduced-motion probe for the app. Reads
 * the OS/browser preference and tracks it live, so toggling it applies without a
 * reload. Guarded for jsdom/older browsers where `matchMedia` (or its modern
 * add/removeEventListener) is missing, so it never breaks a plain render or a test.
 * Promoted out of KoiosPanel's inline copy when the drag layer needed the same
 * signal (§11: a new shared helper lands WITH adoption on the existing copy site).
 */
import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(QUERY).matches
  })

  // Subscribe to preference changes; no-ops where matchMedia is unavailable.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    setReduced(mq.matches)
    if (typeof mq.addEventListener !== 'function') return
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export default usePrefersReducedMotion
