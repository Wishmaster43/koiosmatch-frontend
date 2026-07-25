import type { Candidate } from '@/types/candidate'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
import { ADVICE_META, type KoiosAdvice } from '@/lib/koiosAdviceMeta'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

/**
 * buildCandidateAdviceInsights — profile-level Koios AI insights for the
 * candidate drawer. The FIRST row is the resolved Koios advice — the SAME
 * advice the table's "Koios" column shows (one source, two surfaces, see
 * useCandidateAdvice) — followed by the completeness + engagement heuristics,
 * pure FE, no AI/API call.
 */
export function buildCandidateAdviceInsights(c: Candidate, t: Tx, formatDate: (v: string | null) => string, advice: KoiosAdvice | null): KoiosAdviceInsight[] {
  // Dash placeholders ('-'/'—') are the mapper's EMPTY fallback (e.g. address) —
  // truthy, so a naive Boolean() counted them as filled and the advice said
  // "profiel compleet" while the profile visibly had gaps (Danny punt 47).
  const filled = (v: unknown) => Boolean(v) && v !== '-' && v !== '—'
  const coreFields = [c.email, c.phone, c.dob, c.address, c.gender, c.nationality, c.summary]
  const filledPct = Math.round((coreFields.filter(filled).length / coreFields.length) * 100)

  // Same advice as the table's "Koios" column — resolved once via useCandidateAdvice.
  const adviceColor = advice?.action ? (ADVICE_META[advice.action] ?? ADVICE_META.default).color : ADVICE_META.default.color
  const adviceRow: KoiosAdviceInsight = {
    type: advice?.label ?? t('ai.adviceNoneLabel'),
    color: adviceColor,
    text: advice?.reason ?? t('koios.reasons.none'),
  }

  return [
    adviceRow,
    {
      type: t('ai.completeness'),
      color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
      text: filledPct >= 80 ? t('ai.completeGood') : t('ai.completePartial', { pct: filledPct }),
    },
    {
      type: t('ai.engagementLabel'),
      color: 'var(--color-secondary)',
      text: c.lastContactDate
        ? t('ai.engagementContacted', { date: formatDate(c.lastContactDate) })
        : t('ai.engagementNone'),
    },
  ]
}
