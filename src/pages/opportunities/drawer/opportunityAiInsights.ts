import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
import { isTerminalStage } from '../data/opportunityAdvice'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

/**
 * buildOpportunityAdviceInsights — Koios AI insights for the opportunity drawer's
 * Details tab (mirrors buildMatchAdviceInsights's shape/file placement): a deal-
 * magnitude reading (is there a value or hours figure to plan against at all) +
 * a close-date-window reading (days to expected_close_at, reusing the same
 * terminal-stage check the table's overdue styling uses — §11 one computation).
 * Pure FE heuristics over fields the row already carries — no AI/API call.
 */
export function buildOpportunityAdviceInsights(o: Opportunity, stages: LookupOption[], t: Tx, now: Date = new Date()): KoiosAdviceInsight[] {
  // (a) Deal magnitude health — is there a value OR an hours figure at all, the
  // minimum a recruiter needs to plan against (unit itself is a tenant setting,
  // handled elsewhere — this only checks something was filled in).
  const hasMagnitude = o.value != null || o.hours != null
  const magnitudeInsight: KoiosAdviceInsight = hasMagnitude
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    ? { type: t('ai.dealHealthLabel'), color: 'var(--color-success)', text: t('ai.dealHealthSet') }
    : { type: t('ai.dealHealthLabel'), color: 'var(--color-warning)', text: t('ai.dealHealthMissing') }

  // (b) Close-date window — a terminal stage (won/lost) needs no more advice;
  // otherwise read date-granular days-to-close (mirrors isExpectedCloseOverdue's
  // own day-truncated comparison, so this never disagrees with the table's own
  // overdue styling by a few stray hours).
  const terminal = isTerminalStage(o, stages)
  const today = new Date(now.toDateString())
  const closeDay = o.expectedCloseAt ? new Date(new Date(o.expectedCloseAt).toDateString()) : null
  const days = closeDay ? Math.round((closeDay.getTime() - today.getTime()) / 86400000) : null
  const closeInsight: KoiosAdviceInsight = terminal
    ? { type: t('ai.closeWindowLabel'), color: 'var(--text-muted)', text: t('ai.closeWindowTerminal') }
    : days == null
      ? { type: t('ai.closeWindowLabel'), color: 'var(--text-muted)', text: t('ai.closeWindowUnknown') }
      : days < 0
        ? { type: t('ai.closeWindowLabel'), color: 'var(--color-warning)', text: t('ai.closeWindowOverdue', { days: Math.abs(days) }) }
        // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
        : { type: t('ai.closeWindowLabel'), color: 'var(--color-success)', text: t('ai.closeWindowUpcoming', { days }) }

  return [magnitudeInsight, closeInsight]
}
