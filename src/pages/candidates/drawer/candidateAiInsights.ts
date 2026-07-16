import type { Candidate } from '@/types/candidate'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

/**
 * buildCandidateAdviceInsights — profile-level Koios AI insights (completeness +
 * engagement) for the candidate drawer. Pure FE heuristics, no AI/API call —
 * match score lives in the application drawer, not here.
 */
export function buildCandidateAdviceInsights(c: Candidate, t: Tx, formatDate: (v: string | null) => string): KoiosAdviceInsight[] {
  // Dash placeholders ('-'/'—') are the mapper's EMPTY fallback (e.g. address) —
  // truthy, so a naive Boolean() counted them as filled and the advice said
  // "profiel compleet" while the profile visibly had gaps (Danny punt 47).
  const filled = (v: unknown) => Boolean(v) && v !== '-' && v !== '—'
  const coreFields = [c.email, c.phone, c.dob, c.address, c.gender, c.nationality, c.summary]
  const filledPct = Math.round((coreFields.filter(filled).length / coreFields.length) * 100)

  return [
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
