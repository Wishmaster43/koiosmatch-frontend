/**
 * buildMatchAdviceInsights — Koios AI insights for the match drawer's Overview
 * tab (M18 of the overzicht-layout cluster): a score reading (the match's own
 * ScorePill value) + a contract-window reading (reusing matchExpiry.ts's
 * warning/expired classification, the same computation MatchCard's badge
 * already uses). Pure FE heuristics over fields the row already carries — no
 * AI/API call, mirrors buildVacancyAdviceInsights.
 */
import type { MatchRow } from '@/types/match'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
import { computeMatchExpiry } from '../matchExpiry'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

// Pure FE heuristics over already-loaded fields (see the module doc above): a score reading + a contract-window reading, no AI/API call.
export function buildMatchAdviceInsights(match: MatchRow, t: Tx, now: Date = new Date()): KoiosAdviceInsight[] {
  const score = match.score
  const scoreInsight: KoiosAdviceInsight = score == null
    ? { type: t('ai.scoreLabel'), color: 'var(--text-muted)', text: t('ai.scoreUnknown') }
    : score >= 80
      // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
      ? { type: t('ai.scoreLabel'), color: 'var(--color-success)', text: t('ai.scoreGood', { score }) }
      : score >= 50
        ? { type: t('ai.scoreLabel'), color: 'var(--color-warning)', text: t('ai.scoreAverage', { score }) }
        // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
        : { type: t('ai.scoreLabel'), color: 'var(--color-danger)', text: t('ai.scorePoor', { score }) }

  const expiry = computeMatchExpiry(match.endDate, { closed: match.archived, now })
  const windowInsight: KoiosAdviceInsight = !match.endDate
    ? { type: t('ai.windowLabel'), color: 'var(--text-muted)', text: t('ai.windowUnknown') }
    : expiry?.kind === 'expired'
      // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
      ? { type: t('ai.windowLabel'), color: 'var(--color-danger)', text: t('ai.windowExpired', { days: Math.abs(expiry.days) }) }
      : expiry?.kind === 'warning'
        ? { type: t('ai.windowLabel'), color: 'var(--color-warning)', text: t('ai.windowWarning', { days: expiry.days }) }
        // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
        : { type: t('ai.windowLabel'), color: 'var(--color-success)', text: t('ai.windowFine') }

  return [scoreInsight, windowInsight]
}
