/**
 * departmentAiInsights — Koios advice heuristics for a department's own tab,
 * in its own module like every sibling (locationAiInsights/customerAiInsights):
 * a component file exports only components (react-refresh), helpers live here.
 */
import type { KoiosAdviceInsight } from '@/components/ai/KoiosAdviceBlock'
import type { Department } from '@/types/customer'

// A bound-namespace translate function (mirrors locationAiInsights.ts/customerAiInsights.ts).
export type Tx = (key: string, opts?: Record<string, unknown>) => string

/**
 * buildDepartmentAdviceInsights — Koios advice for THIS department's own fields
 * (description/status/cost centre; name is required so it carries no signal).
 * Pure FE completeness heuristics, no AI/API call — mirrors
 * buildLocationAdviceInsights next to LocationDetail, in its own module per the house
 * pattern (react-refresh: component files export only components).
 */
export function buildDepartmentAdviceInsights(d: Department, t: Tx): KoiosAdviceInsight[] {
  const coreFields = [d.description, d.statusId, d.costCenter]
  const filledPct = Math.round((coreFields.filter(Boolean).length / coreFields.length) * 100)
  return [
    {
      type: t('ai.completeness'),
      color: filledPct >= 80 ? 'var(--color-success)' : 'var(--color-warning)',
      text: filledPct >= 80 ? t('ai.departmentComplete') : t('ai.departmentPartial', { pct: filledPct }),
    },
  ]
}


