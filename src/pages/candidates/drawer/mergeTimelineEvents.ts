/**
 * mergeTimelineEvents — B24: merges N already-mapped `TimelineEvent[]` sources
 * (notes, status/phase changes, application/funnel events, …) into ONE
 * chronological list for the shared `components/ui/EventTimeline` (§3A: one
 * timeline pattern everywhere, never a per-entity fork). EventTimeline itself
 * deliberately does NOT sort (its own header note: "the backend already sends
 * the timeline newest-first … grouping consecutively preserves the caller's
 * order") — so combining multiple sources into one chronologically-interleaved
 * feed is this file's ONE job, kept out of any single tab component.
 *
 * Newest-first, mirroring the single-source convention EventTimeline already
 * assumes. Undated events (`time` missing/invalid) sort last, stable relative
 * to each other, so a bad timestamp never silently jumps to the top.
 */
import type { TimelineEvent } from '@/components/ui/EventTimeline'

// A valid parseable timestamp, or null (sorts last).
const timeOf = (ev: TimelineEvent): number | null => {
  if (!ev.time) return null
  const t = new Date(ev.time).getTime()
  return isNaN(t) ? null : t
}

export function mergeTimelineEvents(...sources: TimelineEvent[][]): TimelineEvent[] {
  return sources
    .flat()
    .map((ev, i) => ({ ev, i })) // stable-sort tiebreaker (Array#sort isn't guaranteed stable in every engine)
    .sort((a, b) => {
      const ta = timeOf(a.ev), tb = timeOf(b.ev)
      if (ta === null && tb === null) return a.i - b.i
      if (ta === null) return 1
      if (tb === null) return -1
      return tb - ta || a.i - b.i
    })
    .map(({ ev }) => ev)
}
