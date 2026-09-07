/**
 * useReportKpiOrdering — resolve KPI order from tenant settings with fallback.
 * Adopted on six report pages (Matches/Tasks/Outreach/Opportunities/Applications/Vacancies).
 */
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey, type ReportKpiScopeId } from '../kpiCatalog'
import { resolveReportKpiOrder } from '../resolveReportKpiOrder'

export function useReportKpiOrdering(scopeId: string) {
  const settingsValues = useAllSettings()
  const scope = scopeId as ReportKpiScopeId
  const catalogKeys = getReportKpiCatalog(scope).map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder(scope)
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey(scope), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)

  return { kpiOrder, fellBack }
}
