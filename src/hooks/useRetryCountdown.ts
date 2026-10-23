/**
 * useRetryCountdown — live "try again in N s" countdown for a throttled (429) request.
 * `seconds` is null when not throttled; start() arms it, clear() disarms it.
 */
import { useState, useEffect, useCallback } from 'react'

export function useRetryCountdown() {
  const [seconds, setSeconds] = useState<number | null>(null)

  // Tick once per second; at 0 the state clears so the submit button re-enables.
  useEffect(() => {
    if (seconds === null) return
    if (seconds <= 0) { setSeconds(null); return }
    const timer = setTimeout(() => setSeconds(s => (s === null ? null : s - 1)), 1000)
    return () => clearTimeout(timer)
  }, [seconds])

  const start = useCallback((n: number) => setSeconds(n), [])
  const clear = useCallback(() => setSeconds(null), [])
  return { seconds, active: seconds !== null && seconds > 0, start, clear }
}
