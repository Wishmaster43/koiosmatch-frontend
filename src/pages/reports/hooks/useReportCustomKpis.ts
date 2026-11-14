/**
 * useReportCustomKpis — the tenant-defined KPI band wiring shared by every
 * report page (KPI-BUILDER-FE-1, CUSTOM-KPI-HOOK-1). Each page repeated the
 * same four lines: derive the active card id from the open drill's route,
 * shape the panel-filter params the definition-drill route takes (by default
 * `phase_filter` is dropped and `customer_id` is renamed to `customer_ids`;
 * candidates and vacancies pass their own params unchanged), build the "open"
 * handler and map the envelope's `custom_kpis[]` onto KpiSpec cards.
 */
import { useTranslation } from 'react-i18next'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { CustomKpiCard } from '@/types/analytics'
import type { DrillSpec } from '../ReportDrillDrawer'
import { makeOpenCustomKpiDrill } from '../lib/drillFactories'
import { useCustomKpiCards } from './useCustomKpiCards'

export interface UseReportCustomKpisOpts {
  data?: { custom_kpis?: CustomKpiCard[] } | null
  drill: DrillSpec | null | undefined
  baseParams: object
  windowSub: () => string
  setDrill: (spec: DrillSpec | null) => void
  entityPage?: string
  // true on the pages whose definition drawer must carry the page's own customer_id[] /
  // phase_filter[] because the BE resolves the card with them (candidates, vacancies;
  // REPORT-DRILL-UNKNOWN-PARAMS-1 FE ACTION 3); the other pages keep the renamed/stripped shape.
  drawerUsesPageParams?: boolean
}

export interface UseReportCustomKpisResult {
  customKpis: KpiSpec[]
  extraTitle: string
}

// Default shape for pages that do not opt in: drops `phase_filter` (the BE
// applies it only to candidate definitions) and renames `customer_id` to the
// route's `customer_ids` alias; a no-op for baseParams carrying neither key.
function toDefinitionDrillParams(baseParams: object): object {
  const withoutPhase = { ...baseParams } as Record<string, unknown> & { phase_filter?: unknown; customer_id?: unknown }
  delete withoutPhase.phase_filter
  const { customer_id: pickedCustomers, ...rest } = withoutPhase
  return pickedCustomers === undefined ? rest : { ...rest, customer_ids: pickedCustomers }
}

export function useReportCustomKpis({
  data, drill, baseParams, windowSub, setDrill, entityPage, drawerUsesPageParams,
}: UseReportCustomKpisOpts): UseReportCustomKpisResult {
  const { t } = useTranslation('analytics')
  // The active card id comes from the currently open drill's own route, so a
  // reopened definition drill still highlights the card it came from.
  const activeCustomKpiId = drill?.rowsEndpoint?.match(/kpi-definitions\/([^/]+)\/drill/)?.[1] ?? null
  const openCustomKpi = makeOpenCustomKpiDrill({
    baseParams: drawerUsesPageParams ? baseParams : toDefinitionDrillParams(baseParams),
    windowSub,
    setDrill,
    ...(entityPage ? { entityPage } : {}),
  })
  const customKpis = useCustomKpiCards({ cards: data?.custom_kpis ?? [], activeId: activeCustomKpiId, onOpen: openCustomKpi })
  return { customKpis, extraTitle: t('customKpi.bandTitle') }
}
