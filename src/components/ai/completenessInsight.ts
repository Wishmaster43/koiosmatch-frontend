/**
 * completenessInsight — the shared "% of core fields filled" Koios-advice row
 * behind every entity's field-completeness heuristic (customerAiInsights,
 * vacancyAiInsights, departmentAiInsights, locationAiInsights, …). Each caller
 * supplies its own list of core field values; this only turns the resulting
 * percentage into the one KoiosAdviceInsight shape they all rendered identically.
 */
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'

type Tx = (key: string, opts?: Record<string, unknown>) => string

// Per-entity keys default to the shared ai.completeGood/completePartial pair;
// department/location insights pass their own entity-specific pair instead.
export interface CompletenessKeys { good?: string; partial?: string }

export function completenessInsight(
  coreFields: unknown[],
  t: Tx,
  keys: CompletenessKeys = {},
  // Custom "counts as filled" predicate — defaults to Boolean(); the candidate
  // drawer passes one that also rejects the mapper's '-'/'—' empty placeholders.
  filled: (v: unknown) => boolean = Boolean,
): KoiosAdviceInsight {
  const filledPct = Math.round((coreFields.filter(filled).length / coreFields.length) * 100)
  return {
    type: t('ai.completeness'),
    color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
    text: filledPct >= 80 ? t(keys.good ?? 'ai.completeGood') : t(keys.partial ?? 'ai.completePartial', { pct: filledPct }),
  }
}
