/**
 * useReportKpiOrdering — resolve KPI order from the API with fallback.
 * Adopted on nine report pages (Candidates/Applications/Customers/Vacancies/Opportunities/Tasks/Matches/Outreach/WhatsApp).
 */
import { REPORT_KPI_FAMILY, getReportKpiCatalog, getReportKpiDefaultOrder, type ReportKpiScopeId, NINE_CARD_STRIP } from '../kpiCatalog'
import { resolveReportKpiOrder } from '../resolveReportKpiOrder'
import { useReportKpiSelection } from './useReportKpiSelection'

// The report strip is always nine cards (ReportKpiBand): a backend default or a stored list
// shorter than nine (vacancies/opportunities default to four) is topped up with the remaining
// catalogue cards in catalogue order, so the strip never reflows. Axis scopes build their own strip.

// Pure top-up of a resolved order for a fixed-family scope.
export function padKpiOrder(order: string[], catalogKeys: string[]): string[] {
  const padded = [...order]
  for (const key of catalogKeys) {
    if (padded.length >= NINE_CARD_STRIP) break
    if (!padded.includes(key)) padded.push(key)
  }
  return padded
}

export function useReportKpiOrdering(scopeId: string) {
  const scope = scopeId as ReportKpiScopeId
  const catalogKeys = getReportKpiCatalog(scope).map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder(scope)
  const { data: stored, isLoading } = useReportKpiSelection(scope)
  const { order: resolved, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpiOrder = REPORT_KPI_FAMILY[scope] === 'fixed' ? padKpiOrder(resolved, catalogKeys) : resolved

  return { kpiOrder, fellBack, isLoading }
}
