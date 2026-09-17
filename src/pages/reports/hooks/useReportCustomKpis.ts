/**
 * useReportCustomKpis — the tenant-defined KPI band wiring shared by every
 * report page (KPI-BUILDER-FE-1, CUSTOM-KPI-HOOK-1). Each page repeated the
 * same four lines: derive the active card id from the open drill's route,
 * strip the panel-filter params the definition-drill route does not accept
 * (`phase_filter` is a report-local view switch; `customer_id` is this page's
 * own key while the shared route expects `customer_ids`), build the "open"
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
}

export interface UseReportCustomKpisResult {
  customKpis: KpiSpec[]
  extraTitle: string
}

// Drops the report-local `phase_filter` and renames `customer_id` to the
// shared route's `customer_ids` — a no-op for pages whose baseParams carries
// neither key, so every page can pass its own baseParams unchanged.
function toDefinitionDrillParams(baseParams: object): object {
  const withoutPhase = { ...baseParams } as Record<string, unknown> & { phase_filter?: unknown; customer_id?: unknown }
  delete withoutPhase.phase_filter
  const { customer_id: pickedCustomers, ...rest } = withoutPhase
  return pickedCustomers === undefined ? rest : { ...rest, customer_ids: pickedCustomers }
}

export function useReportCustomKpis({
  data, drill, baseParams, windowSub, setDrill, entityPage,
}: UseReportCustomKpisOpts): UseReportCustomKpisResult {
  const { t } = useTranslation('analytics')
  // The active card id comes from the currently open drill's own route, so a
  // reopened definition drill still highlights the card it came from.
  const activeCustomKpiId = drill?.rowsEndpoint?.match(/kpi-definitions\/([^/]+)\/drill/)?.[1] ?? null
  const openCustomKpi = makeOpenCustomKpiDrill({
    baseParams: toDefinitionDrillParams(baseParams),
    windowSub,
    setDrill,
    ...(entityPage ? { entityPage } : {}),
  })
  const customKpis = useCustomKpiCards({ cards: data?.custom_kpis ?? [], activeId: activeCustomKpiId, onOpen: openCustomKpi })
  return { customKpis, extraTitle: t('customKpi.bandTitle') }
}
