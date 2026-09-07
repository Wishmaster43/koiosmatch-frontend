/**
 * useSeriesDrill — date-series drill pick (onSeriesPick pattern). Finds the
 * timeseries point by date key and opens the drill with proper bucket/week
 * wiring. One-liner adopted on four report pages (Applications/Tasks/Outreach/
 * Opportunities).
 */
import type { CandidateTimeseriesPoint } from '@/types/analytics'
import { gateDrillClick, type DrillableReport } from '../reportDrillGate'
import type { DrillSpec } from '../ReportDrillDrawer'

export function useSeriesDrill(
  reportKey: string,
  data: { timeseries?: { bucket?: string; series?: CandidateTimeseriesPoint[] }; from?: string; to?: string } | null | undefined,
  baseParams: unknown,
  windowSub: () => string,
  setDrill: (drill: DrillSpec | null) => void,
  entityPage?: string,
) {
  // Helper to open the bucket drill with optional week bucket param.
  const openBucket = (pt: CandidateTimeseriesPoint) => {
    const params = baseParams as Record<string, unknown> || {}
    const drill: DrillSpec = {
      title: pt.label,
      value: pt.value,
      subtitle: windowSub(),
      rowsEndpoint: `/reports/${reportKey}/drill`,
      rowsParams: { ...params, date: pt.date, ...(data?.timeseries?.bucket === 'week' ? { bucket: 'week' } : {}) },
      adviceEndpoint: `/reports/${reportKey}/advice`,
      adviceParams: { ...params, date: pt.date, ...(data?.timeseries?.bucket === 'week' ? { bucket: 'week' } : {}) },
    }
    if (entityPage) {
      drill.entityPage = entityPage as DrillableReport
    }
    setDrill(drill)
  }

  // One-liner onClick handler: find the point by date key, open its drill.
  const onSeriesPick = gateDrillClick(reportKey as DrillableReport, (dateKey: string) => {
    const pt = data?.timeseries?.series?.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  return { onSeriesPick }
}
