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
 * buildApplicationAdviceInsights — Koios AI insights for the application drawer:
 * an AI-task insight (when the application carries one — DUPLICATE-AI-BLOCK-1,
 * Danny 25-07: the tab used to render its OWN separate "Taak" block next to this
 * one, so the same AI-branded surface appeared twice; the task is now folded in
 * here as the first insight so there is only ONE Koios-branded block on screen),
 * a progress insight (days IN PROCESS since the application was created — NOT
 * "time in phase": the backend only exposes phase transitions as prose in the
 * timeline, so we honestly report time-since-applying and mention the current
 * phase only as context; true time-in-phase is APP-STAGE-DURATIONS-1, still open)
 * flagged when a non-terminal application sits stale > 14 days, and a completeness
 * insight only when a meaningful gap exists (no vacancy link). Pure FE heuristics,
 * no AI/API call.
 */
export function buildApplicationAdviceInsights(a: ApplicationDetail, t: Tx, now: Date = new Date()): KoiosAdviceInsight[] {
  const insights: KoiosAdviceInsight[] = []

  // DUPLICATE-AI-BLOCK-1: the AI task used to render in its own standalone block
  // in ApplicationTab — folded in here first so it reads as one advice, not two.
  if (a.task) {
    insights.push({ type: t('drawer.task'), color: 'var(--color-primary)', text: a.task })
  }

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
