// Extract the identical lat/lng/distanceKm/score/criteria mapping from
// both useVacancySearch and useCandidateSearch — one source, two consumers.
import { toCoord } from '@/lib/coords'
import type { Criterion } from '@/components/match/MatchScoreBlock'

// The match-row shape both hooks already had inline (score/distance/criteria/AI
// advice) — a fixed interface, not `unknown`, so a field typo fails tsc again.
// Both shapes are fully optional, so TypeScript's weak-type check (TS2559, "no
// properties in common") itself catches a swapped (match, entity) call — the
// generic below is only for the entity side's own vacancy/candidate row type.
interface SearchHitMatch {
  distance_km?: unknown
  score?: unknown
  criteria?: unknown
  ai_advised?: unknown
  ai_advice_reason?: string | null
}

// The entity side only ever needs lat/lng here — generic over the caller's own
// vacancy/candidate row type so a field typo on THAT side fails tsc too (this
// shape previously erased to `unknown`).
interface SearchHitEntity {
  lat?: unknown
  lng?: unknown
}

// Map a search result to the common {lat, lng, distanceKm, score, criteria, aiAdvised, aiAdviceReason} fields.
export function mapSearchHit<E extends SearchHitEntity>(
  match: SearchHitMatch,
  entity: E,
): {
  lat: number | null
  lng: number | null
  distanceKm: number | null
  score: number | null
  criteria: Criterion[]
  aiAdvised: boolean
  aiAdviceReason: string | null
} {
  return {
    lat: toCoord(entity.lat),
    lng: toCoord(entity.lng),
    distanceKm: toCoord(match.distance_km),
    score: typeof match.score === 'number' ? match.score : Number(match.score) || null,
    criteria: Array.isArray(match.criteria) ? (match.criteria as Criterion[]) : [],
    aiAdvised: Boolean(match.ai_advised),
    aiAdviceReason: match.ai_advice_reason ?? null,
  }
}
