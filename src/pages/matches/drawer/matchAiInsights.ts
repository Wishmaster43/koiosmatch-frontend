import type { MatchRow } from '@/types/match'
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
import { computeMatchExpiry } from '../matchExpiry'

// A bound-namespace translate function (the caller already resolved the namespace).
type Tx = (key: string, opts?: Record<string, unknown>) => string

/**
 * buildMatchAdviceInsights — Koios AI insights for the match drawer's Overview
 * tab (M18 of the overzicht-layout cluster): a score reading (the match's own
 * ScorePill value) + a contract-window reading (reusing matchExpiry.ts's
 * warning/expired classification, the same computation MatchCard's badge
 * already uses). Pure FE heuristics over fields the row already carries — no
 * AI/API call, mirrors buildVacancyAdviceInsights.
 */
export function buildMatchAdviceInsights(match: MatchRow, t: Tx, now: Date = new Date()): KoiosAdviceInsight[] {
  const score = match.score
  const scoreInsight: KoiosAdviceInsight = score == null
    ? { type: t('ai.scoreLabel'), color: 'var(--text-muted)', text: t('ai.scoreUnknown') }
    : score >= 80
      ? { type: t('ai.scoreLabel'), color: 'var(--color-success)', text: t('ai.scoreGood', { score }) }
      : score >= 50
        ? { type: t('ai.scoreLabel'), color: 'var(--color-warning)', text: t('ai.scoreAverage', { score }) }
        : { type: t('ai.scoreLabel'), color: 'var(--color-danger)', text: t('ai.scorePoor', { score }) }

  const expiry = computeMatchExpiry(match.endDate, { closed: match.archived, now })
  const windowInsight: KoiosAdviceInsight = !match.endDate
    ? { type: t('ai.windowLabel'), color: 'var(--text-muted)', text: t('ai.windowUnknown') }
    : expiry?.kind === 'expired'
      ? { type: t('ai.windowLabel'), color: 'var(--color-danger)', text: t('ai.windowExpired', { days: Math.abs(expiry.days) }) }
      : expiry?.kind === 'warning'
        ? { type: t('ai.windowLabel'), color: 'var(--color-warning)', text: t('ai.windowWarning', { days: expiry.days }) }
        : { type: t('ai.windowLabel'), color: 'var(--color-success)', text: t('ai.windowFine') }

  return [scoreInsight, windowInsight]
}
