/**
 * useThreadViewPrefs — the per-user message order, the minute clock behind the
 * session-window countdown and the order-aware message sort for ConversationsSection.
 */
import { useCallback, useEffect, useState } from 'react'
import type { MessageRow } from './ConversationMessage'

// How often the "time left in the window" line re-reads the clock. One minute is
// the display resolution, so anything faster would only burn renders.
export const WINDOW_TICK_MS = 60_000

// WA-THREAD-UX-1: per-user message-order preference, remembered across drawers
// (never per-thread — Danny 20-09 asked for one switch the recruiter sets once).
const SORT_STORAGE_KEY = 'km:conversation-sort'
export type MessageSort = 'oldest' | 'newest'

// Read the stored sort preference; a private window / blocked storage falls
// back to the default silently (§9 localStorage contract).
function readStoredSort(): MessageSort {
  try {
    const v = localStorage.getItem(SORT_STORAGE_KEY)
    return v === 'newest' ? 'newest' : 'oldest'
  } catch {
    return 'oldest'
  }
}

// Sort order + persistence, the ticking clock and the sorter.
export function useThreadViewPrefs() {
  // WA-WINDOW-1: a ticking "now" so the remaining-window line counts down while the drawer stays open.
  const [nowMs, setNowMs] = useState<number>(() => Date.now())
  const [sortOrder, setSortOrder] = useState<MessageSort>(readStoredSort)

  // Persist the sort choice (a blocked/private storage must never throw into the render path).
  const changeSortOrder = useCallback((value: string) => {
    const next: MessageSort = value === 'newest' ? 'newest' : 'oldest'
    setSortOrder(next)
    try { localStorage.setItem(SORT_STORAGE_KEY, next) } catch { /* private window / blocked storage: preference just doesn't persist */ }
  }, [])

  // Re-read the clock every minute (§9: the interval is set up AND torn down inside the effect, so StrictMode's double mount is harmless).
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), WINDOW_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  // Sort a thread's messages by sent_at (the field the API returns); an unparsed/missing
  // stamp keeps its original server-order position instead of being reshuffled.
  const sortMessages = useCallback((list: MessageRow[]): MessageRow[] => {
    const withIndex = list.map((m, index) => ({ m, index }))
    withIndex.sort((a, b) => {
      const ta = a.m.sent_at ? new Date(a.m.sent_at).getTime() : NaN
      const tb = b.m.sent_at ? new Date(b.m.sent_at).getTime() : NaN
      if (Number.isNaN(ta) || Number.isNaN(tb)) return a.index - b.index
      return sortOrder === 'oldest' ? ta - tb : tb - ta
    })
    return withIndex.map(({ m }) => m)
  }, [sortOrder])

  return { nowMs, sortOrder, changeSortOrder, sortMessages }
}
