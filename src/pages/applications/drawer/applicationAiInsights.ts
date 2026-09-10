// applicationAiInsights — pure FE Koios heuristic insights for the application
// drawer (progress/staleness + a completeness gap). See buildApplicationAdviceInsights
// below for the full reasoning and what deliberately moved to useApplicationAdvice.
import type { ApplicationDetail } from '@/types/application'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
// Shared day count from lib/localDate (side-effect-free; the datetime module would
// drag the i18n init into this pure builder). `futureAsZero` keeps the clamp this
// builder always had: a future `created` reads as 0 days, never as unknown.
import { daysSince } from '@/lib/localDate'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

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

  const days = daysSince(a.created, now, true)
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
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    insights.push({ type: t('ai.completeness'), color: 'var(--color-warning)', text: t('ai.missingVacancy') })
  }

  return insights
}

/**
 * resolveAdviceReason — the advice sentence for the reject modal in the USER's
 * language (DEMO-TAAL): a known advice_reason_key renders rejection.adviceReasons.<key>
 * (with the failed criterion interpolated), and the server's own sentence is the
 * fallback when no key came along (older payloads). Null when there is nothing.
 */
export function resolveAdviceReason(ai: ApplicationDetail['ai'], t: Tx): string | null {
  if (!ai) return null
  if (ai.advice_reason_key) {
    return t(`rejection.adviceReasons.${ai.advice_reason_key}`, { criterion: ai.advice_reason_criterion ?? '', defaultValue: ai.advice_reason ?? '' })
  }
  return ai.advice_reason || null
}
