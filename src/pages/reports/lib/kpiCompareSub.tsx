/**
 * totalCompareSubFor — the one-line `subFor` every report's "total" KPI card
 * uses to show its year/period-on-period compare metric. Every page built the
 * same `key === 'total' && totalCompare ? <ReportCompareMetric .../> : undefined`
 * ternary by hand (DRY round, jscpd pair on MatchesReport/OpportunitiesReport).
 * Lives as its own .tsx (not lib/kpiSpecs.ts) because it renders JSX.
 */
import type { ReactNode } from 'react'
import ReportCompareMetric from '../ReportCompareMetric'
import type { CompareMetric } from '../useReportCompare'

// `totalKey` defaults to 'total' but some envelopes key their headline card
// differently (outreach's is 'total_targets') — pass the report's own key.
export function totalCompareSubFor(totalCompare: CompareMetric | undefined, totalKey: string = 'total') {
  return (key: string): ReactNode | undefined =>
    key === totalKey && totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined
}
