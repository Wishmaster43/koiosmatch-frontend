// applicationAiInsights — pure FE Koios heuristic insights for the application
// drawer (progress/staleness + a completeness gap). See buildApplicationAdviceInsights
// below for the full reasoning and what deliberately moved to useApplicationAdvice.
import type { ApplicationDetail } from '@/types/application'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

// Whole days between an ISO date and now; null when the date is missing/unparseable
// so a bad or absent `created` never leaks into the copy as NaN.
function daysSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000))
}

// A funnel is "done" once it lands in matched/rejected — staleness only applies
// while it is still moving (bucketOfPhase in applicationsShared.ts).
const isTerminalBucket = (bucket: string): boolean => bucket === 'matched' || bucket === 'rejected'
const STALE_AFTER_DAYS = 14

/**
 * buildApplicationAdviceInsights — Koios AI heuristic insights for the
 * application drawer. The AI-task advice row is NOT built here any more:
 * KOIOS-ADVIES-OVERAL-1 moved it to the SAME resolver the applications table's
 * Koios column uses (useApplicationAdvice → adviceInsightRows, prepended by
 * ContextSubTab), so the table pill and the drawer row can never disagree —
 * while DUPLICATE-AI-BLOCK-1 still holds: it stays ONE Koios-branded block.
 * This builder keeps the pure FE heuristics: a progress insight (days IN
 * PROCESS since the application was created — NOT "time in phase": the backend
 * only exposes phase transitions as prose in the timeline, so we honestly
 * report time-since-applying and mention the current phase only as context;
 * true time-in-phase is APP-STAGE-DURATIONS-1, still open) flagged when a
 * non-terminal application sits stale > 14 days, and a completeness insight
 * only when a meaningful gap exists (no vacancy link). No AI/API call.
 */
export function buildApplicationAdviceInsights(a: ApplicationDetail, t: Tx, now: Date = new Date()): KoiosAdviceInsight[] {
  const insights: KoiosAdviceInsight[] = []

  const days = daysSince(a.created, now)
  const phase = a.phaseLabel || a.phaseKey || '—'
  const stale = !isTerminalBucket(a.bucket) && days !== null && days > STALE_AFTER_DAYS

  insights.push({
    type: t('ai.progressLabel'),
    color: stale ? 'var(--color-warning)' : 'var(--color-secondary)',
    text: days === null
      ? t('ai.progressUnknown', { phase })
      : stale
        ? t('ai.progressStale', { days, phase })
        : t('ai.progressOk', { days, phase }),
  })

  // Only surface a completeness gap when there actually is one — a missing vacancy link.
  const hasVacancy = Boolean(a.vacancyId ?? a.vacancy?.id)
  if (!hasVacancy) {
    insights.push({ type: t('ai.completeness'), color: 'var(--color-warning)', text: t('ai.missingVacancy') })
  }

  return insights
}
