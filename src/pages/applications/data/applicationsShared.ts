/**
 * Shared, non-mock helpers for the applications feature. Pure functions only —
 * safe to use on real API data (no demo/fallback rows live here).
 */
import type { LookupItem } from '@/context/LookupsContext'

// The three list buckets are derived from the funnel-stage FLAGS (is_match/is_rejected
// on the tenant funnel-types lookup — LookupsContext), never the literal phase key (A1:
// a tenant may rename 'hired'/'rejected' to anything). `funnelTypes` defaults to []
// only for callers that genuinely have no lookup in scope (rare, pure-mapper contexts);
// in that case fall back to the historical slugs so a bare API dump never mis-buckets —
// mirrors the documented flag()-fallback convention in LookupsContext.normalize().
export const bucketOfPhase = (key: string, funnelTypes: LookupItem[] = []): string => {
  const stage = funnelTypes.find(f => f.value === key)
  if (stage) return stage.is_match ? 'matched' : stage.is_rejected ? 'rejected' : 'active'
  if (funnelTypes.length) return 'active'
  return key === 'rejected' ? 'rejected' : key === 'hired' ? 'matched' : 'active'
}

// INTERVIEW-PHASE-1: token colour per UNIVERSAL interview category — never a
// hardcoded hex (§4). Same semantic tokens used everywhere else for an
// in-progress/success/warning/danger outcome.
// W31 (07-08): 'paused' fell through to the `default` info tint — the exact same
// colour as a live 'busy' session, so a recruiter-took-over chip read identically
// to "AI still going". Paused now gets its own warning tint (§4 semantic tokens).
export const interviewCategoryColor = (category: string): string => {
  switch (category) {
    case 'completed':    return 'var(--color-success)'
    case 'disqualified': return 'var(--color-danger)'
    case 'paused':        return 'var(--color-warning)'
    default:              return 'var(--color-info)' // 'busy'
  }
}
