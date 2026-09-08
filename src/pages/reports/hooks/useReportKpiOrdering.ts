/**
 * useReportKpiOrdering — resolve KPI order from the API with fallback.
 * Adopted on nine report pages (Candidates/Applications/Customers/Vacancies/Opportunities/Tasks/Matches/Outreach/WhatsApp).
 */
import { getReportKpiCatalog, getReportKpiDefaultOrder, type ReportKpiScopeId } from '../kpiCatalog'
import { resolveReportKpiOrder } from '../resolveReportKpiOrder'
import { useReportKpiSelection } from './useReportKpiSelection'

export function useReportKpiOrdering(scopeId: string) {
  const scope = scopeId as ReportKpiScopeId
  const catalogKeys = getReportKpiCatalog(scope).map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder(scope)
  const { data: stored, isLoading } = useReportKpiSelection(scope)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)

  return { kpiOrder, fellBack, isLoading }
}
