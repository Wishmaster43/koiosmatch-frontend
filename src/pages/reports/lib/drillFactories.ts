/**
 * Shared drill-opener factories for the report pages. Every report built the same
 * two closures by hand: a per-KPI-card drill (title/value/subtitle/rowsEndpoint
 * keyed on `kpi`) and a per-axis-segment drill (same shape plus an advice
 * endpoint and an arbitrary XOR param) — both gated through gateDrillClick and
 * both reading the page's own baseParams/windowSub. Extracted so the endpoint
 * strings and field names cannot drift between reports (DRY round, jscpd pairs
 * on ApplicationsReport/OpportunitiesReport/VacanciesReport).
 *
 * Both builders take a single named options object (mirrors BuildKpiSpecsOpts/
 * ServerKpiSpecsOpts in the sibling lib/kpiSpecs.ts) rather than positional
 * strings — a positional signature let rowsEndpoint/adviceEndpoint (or report/
 * entityPage) be silently swapped at a call site with no type error.
 */
import { gateDrillClick } from '../reportDrillGate'
import type { DrillableReport } from '../reportDrillGate'
import type { DrillSpec } from '../ReportDrillDrawer'

export interface OpenKpiDrillOpts {
  report: DrillableReport
  rowsEndpoint: string
  baseParams: object
  windowSub: () => string
  setDrill: (spec: DrillSpec | null) => void
  // Every existing report names its drill's entityPage the same as its own
  // `report` id, so that is the default; pass `null` to omit entityPage
  // entirely (outreach drill rows are call-list targets, not one entity page).
  entityPage?: string | null
}

// Builds the "open this KPI card's drill" handler: one XOR param (`kpi`) layered
// on the report's own baseParams, subtitle defaulting to the report's window label.
export function makeOpenKpiDrill(o: OpenKpiDrillOpts) {
  const entityPage = o.entityPage === null ? undefined : (o.entityPage ?? o.report)
  return (kpi: string, label: string, value: string | number, subtitle?: string) =>
    gateDrillClick(o.report, () => o.setDrill({
      title: label, value, subtitle: subtitle ?? o.windowSub(),
      ...(entityPage ? { entityPage } : {}),
      rowsEndpoint: o.rowsEndpoint, rowsParams: { ...o.baseParams, kpi },
    }))
}

export interface OpenSegmentOpts {
  rowsEndpoint: string
  adviceEndpoint: string
  baseParams: object
  windowSub: () => string
  setDrill: (spec: DrillSpec | null) => void
  // Omit for reports whose drill rows are not a single unambiguous entity page
  // (mirrors makeOpenKpiDrill's entityPage — see OutreachReport).
  entityPage?: string
}

// Builds the "open this axis segment's drill" handler: an arbitrary XOR param
// (e.g. `{ stage: value }`) layered on baseParams, plus the matching advice
// endpoint — the shape every axis/bucket click shares across the report pages.
export function makeOpenSegment(o: OpenSegmentOpts) {
  return (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    o.setDrill({
      title: seg.label, value: seg.count, subtitle: o.windowSub(),
      ...(o.entityPage ? { entityPage: o.entityPage } : {}),
      rowsEndpoint: o.rowsEndpoint, rowsParams: { ...o.baseParams, ...xorParam },
      adviceEndpoint: o.adviceEndpoint, adviceParams: { ...o.baseParams, ...xorParam },
    })
}
