/**
 * useOrderedReportKpis (DRY round 11) — combines useReportKpiOrdering with the
 * order→spec-array projection seven report pages repeated the same two lines
 * for: resolve the tenant's stored KPI order, then pick/arrange the caller's
 * own kpiByKey record into it (orderKpis, already shared — dropping any key
 * without a spec). `kpiByKey` stays page-supplied (rule B): each report's own
 * KPI vocabulary and card-building logic never move here.
 */
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { useReportKpiOrdering } from './useReportKpiOrdering'
import { orderKpis } from '../lib/kpiOrder'

export function useOrderedReportKpis(
  scopeId: string,
  kpiByKey: Record<string, KpiSpec>,
): { kpis: KpiSpec[]; fellBack: boolean } {
  const { kpiOrder, fellBack } = useReportKpiOrdering(scopeId)
  const kpis = orderKpis(kpiOrder, kpiByKey)
  return { kpis, fellBack }
}
