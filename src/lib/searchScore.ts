// Extract the identical lat/lng/distanceKm/score/criteria mapping from
// both useVacancySearch and useCandidateSearch — one source, two consumers.
import { toCoord } from '@/lib/coords'
import type { Criterion } from '@/components/match/MatchScoreBlock'

// Map a search result to the common {lat, lng, distanceKm, score, criteria, aiAdvised, aiAdviceReason} fields.
export function mapSearchHit(
  match: unknown,
  entity: unknown,
): {
  lat: number | null
  lng: number | null
  distanceKm: number | null
  score: number | null
  criteria: Criterion[]
  aiAdvised: boolean
  aiAdviceReason: string | null
} {
  const m = match as Record<string, unknown>
  const e = entity as Record<string, unknown>
  return {
    lat: toCoord(e.lat),
    lng: toCoord(e.lng),
    distanceKm: toCoord(m.distance_km),
    score: typeof m.score === 'number' ? m.score : Number(m.score) || null,
    criteria: Array.isArray(m.criteria) ? (m.criteria as Criterion[]) : [],
    aiAdvised: Boolean(m.ai_advised),
    aiAdviceReason: (m.ai_advice_reason as string) ?? null,
  }
}
