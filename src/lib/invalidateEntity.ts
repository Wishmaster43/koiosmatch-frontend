/**
 * invalidateEntity — cross-entity react-query cache reconciliation after a write
 * that other surfaces have already denormalised into their own cached rows, so
 * a save on one screen doesn't leave a stale copy showing elsewhere until reload.
 */
import type { QueryClient } from '@tanstack/react-query'

// Query roots whose rows embed a candidate's denormalised name/function.
const CANDIDATE_BEARING_ROOTS = new Set(['candidates', 'applications'])

/**
 * Cross-entity cache reconciliation after a candidate write (REFRESH-FIX-2).
 * A candidate's joined name/function is DENORMALISED onto application rows
 * (candidateName/candidateInitials, candidate.function), and three separate
 * surfaces PATCH /candidates/{id} — the candidate drawer, the application
 * drawer's header pencil, and its Kandidaat tab — each merging the result
 * LOCALLY into its own view. Without this, the OTHER surfaces' cached queries
 * stay stale until a hard refresh.
 *
 * Scope: every `['candidates', …]` / `['applications', …]` query EXCEPT the
 * `'stats'` branches — a name/function edit cannot move any distribution, and
 * those aggregations are the expensive ones (STATS-OOM-1, served via heavyGet).
 * The id-scoped detail queries (`['candidates', id]`) are reached by the root
 * match, so no per-id key is needed.
 */
export function invalidateCandidate(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    predicate: q => CANDIDATE_BEARING_ROOTS.has(String(q.queryKey[0])) && q.queryKey[1] !== 'stats',
  })
}
