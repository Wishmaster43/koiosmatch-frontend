import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
import { ADVICE_META, type KoiosAdvice } from '@/lib/koiosAdviceMeta'

/**
 * adviceInsightRows — KOIOS-ADVIES-OVERAL-1 (Danny): the drawer's Koios block
 * must show EXACTLY the advice the table's "Koios" column shows, resolved by the
 * SAME per-entity hook (useXAdvice) — one source, two surfaces, never two
 * derivations. This maps that resolved advice onto the shared block's insight
 * row: the row label IS the pill label, the colour comes from the shared
 * ADVICE_META. Returns [] when there is no advice, so callers spread the result
 * and render no empty row (or, for advice-only sections, no block at all).
 */
export function adviceInsightRows(advice: KoiosAdvice | null | undefined): KoiosAdviceInsight[] {
  if (!advice?.action || advice.action === 'none') return []
  const meta = ADVICE_META[advice.action] ?? ADVICE_META.default
  const label = advice.label || advice.action
  // The reason is the expandable text; label-only advice (applications' free-text
  // task) repeats its label so the expanded row is never blank.
  return [{ type: label, color: meta.color, text: advice.reason || label }]
}
