/**
 * koiosAdviceMap — the ONE shape + mapper for `koios_ai_advice` (S1 K-266/K-267,
 * KOIOS-ADVIES-OVERAL-1), the new per-record Koios AI advice CACHE the backend
 * writes when a real `koios_advice_<entity>` workflow run completes. Shared by
 * all five entity mappers (candidate/application/vacancy/customer/match) so the
 * snake_case → camelCase transform (`generated_at` → `generatedAt`, `run_id` →
 * `runId`) lives in exactly one place, never copy-pasted five times.
 *
 * Distinct from `KoiosAdvice` (koiosAdviceMeta.tsx) — that type is the older,
 * per-entity DETERMINISTIC rule-engine card (candidates/applications' own
 * `koios_advice`); this one is the new AI-generated cache, always a SEPARATE key
 * on the wire (`koios_ai_advice`) so the two never collide.
 *
 * List rows carry only {verdict, score}; the detail resource adds {text,
 * language, generated_at, run_id} — one tolerant shape covers both, since every
 * extra field is optional and simply absent on a list-row payload.
 */

/** The UI-shape Koios AI advice block, camelCase. */
export interface KoiosAiAdvice {
  verdict: string | null
  score: number | null
  text?: string | null
  language?: string | null
  generatedAt?: string | null
  runId?: string | null
}

/** Raw `koios_ai_advice` as the API sends it (ContractResource::koiosAdviceBlock/koiosAdviceCompact). */
export interface ApiKoiosAiAdvice {
  verdict?: string | null
  score?: number | null
  text?: string | null
  language?: string | null
  generated_at?: string | null
  run_id?: string | null
}

// Tolerant raw → UI mapper: null/undefined stays null (never a fabricated block),
// snake_case detail-only fields map to camelCase, absent on a list row simply
// stays undefined rather than throwing.
export function mapKoiosAiAdvice(raw: ApiKoiosAiAdvice | null | undefined): KoiosAiAdvice | null {
  if (!raw) return null
  return {
    verdict: raw.verdict ?? null,
    score: raw.score ?? null,
    text: raw.text ?? null,
    language: raw.language ?? null,
    generatedAt: raw.generated_at ?? null,
    runId: raw.run_id ?? null,
  }
}
