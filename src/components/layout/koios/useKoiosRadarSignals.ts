/**
 * useKoiosRadarSignals — fetches the candidate attention signals the backend
 * already aggregates (/candidates/stats.attention) for the Koios landing-state
 * radar block ("Koios Advies"). Purely read-only, no new data model. IDs mirror
 * useCandidateFilters' attentionFilter values 1:1 so a click can deep-link
 * straight into the candidates page filter. `missing_appointment` has no
 * candidate-list filter yet (v1 scope) so it is intentionally left out of the
 * mapped list — a fase-2 follow-up once that filter exists.
 */
import { useEffect, useState } from 'react'
import { heavyGet } from '@/lib/heavyGet'
import { unwrap } from '@/lib/api'
import type { CandidateStats } from '@/types/candidate'

export type RadarSignalId = 'intakePlanned' | 'stale6m' | 'neverContacted' | 'noFollowup' | 'activeConv' | 'hasTasks'
export interface RadarSignal { id: RadarSignalId; count: number }

type AttentionStats = NonNullable<CandidateStats['attention']>

// Priority order (most urgent first) + the /candidates/stats.attention key each
// signal reads from. Only non-zero signals are ever returned to the caller.
const SIGNAL_ORDER: Array<{ id: RadarSignalId; statKey: keyof AttentionStats }> = [
  { id: 'intakePlanned',  statKey: 'intake_planned' },
  { id: 'stale6m',        statKey: 'stale_6m' },
  { id: 'neverContacted', statKey: 'never_contacted' },
  { id: 'noFollowup',     statKey: 'no_followup_planned' },
  { id: 'activeConv',     statKey: 'active_conversations' },
  { id: 'hasTasks',       statKey: 'tasks' },
]

export function useKoiosRadarSignals() {
  const [signals, setSignals] = useState<RadarSignal[] | null>(null)
  const [error,   setError]   = useState(false)

  // One-shot fetch on mount — the panel only mounts this component while showing
  // the landing state, so there is no need for extra enable/disable plumbing.
  // heavyGet already dedupes concurrent calls and cools down after a failure.
  useEffect(() => {
    let alive = true
    heavyGet('/candidates/stats')
      .then(res => {
        if (!alive) return
        const attention = ((unwrap(res) ?? null) as CandidateStats | null)?.attention ?? {}
        const list = SIGNAL_ORDER
          .map(({ id, statKey }) => ({ id, count: attention[statKey] ?? 0 }))
          .filter(s => s.count > 0)
        setSignals(list)
      })
      .catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [])

  return { signals, loading: signals === null && !error, error }
}
