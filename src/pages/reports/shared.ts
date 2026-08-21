/**
 * reports — PUBLIC surface (§2 barrel decision, Danny 21-08).
 * Everything another entity may import from this folder lives HERE; anything
 * not exported below is internal and off-limits cross-entity (lint-enforced).
 * Whoever changes a module re-exported here knows outsiders ride along —
 * extend this list deliberately, never bypass it with a deep import.
 */
export { default as ReportKpiBand } from './ReportKpiBand'
export { REPORT_KPI_FAMILY, REPORT_KPI_PINNED_FIRST, REPORT_KPI_SCOPE_IDS, getReportKpiCatalog, getReportKpiDefaultOrder, reportHasSpareKpiCards, reportKpiSettingsKey } from './kpiCatalog'
export type { ReportKpiScopeId } from './kpiCatalog'
export { LEGACY_REPORT_ROUTE_ALIASES, REPORT_IDS } from './reportIds'
export { resolveReportKpiOrder } from './resolveReportKpiOrder'
