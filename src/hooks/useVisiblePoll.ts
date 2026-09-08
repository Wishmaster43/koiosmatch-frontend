import { useEffect } from 'react'

// Re-run `load` every `intervalMs` while the document is visible (a backgrounded tab never burns requests);
// `enabled` false stops the timer. Cleanup clears the timer. The FIRST load stays at the call site.
export function useVisiblePoll(load: () => void, intervalMs: number, enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, intervalMs)
    return () => clearInterval(id)
  }, [load, intervalMs, enabled])
}
