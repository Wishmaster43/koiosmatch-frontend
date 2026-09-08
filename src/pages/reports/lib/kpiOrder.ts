import type { KpiSpec } from '@/components/insights/InsightsRow'

/**
 * Order KPIs by the tenant's stored order. The order is determined by
 * useReportKpiOrdering (user settings) and is applied here to filter and
 * arrange the KPI cards.
 *
 * @param kpiOrder - Ordered list of KPI keys from the tenant's settings
 * @param kpiByKey - Lookup map of KPI specs by key
 * @returns Ordered array of KPI specs, excluding any keys not found
 */
export const orderKpis = (kpiOrder: string[], kpiByKey: Record<string, KpiSpec>): KpiSpec[] =>
  kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)
