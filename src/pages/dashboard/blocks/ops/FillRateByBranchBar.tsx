/**
 * FillRateByBranchBar — ops tile: vacancy fill rate per branch
 * (dash.fill_rate_by_branch). The server already emits the rate as a 0..100
 * percentage (FillRateSeries.php:81), so the chart is plotted with
 * percentValues, never showPercent (which would re-derive a share of the sum).
 * Rows with a null rate carry no cohort to chart and are skipped. The
 * vacancies page has no branch/location intent to drill into (it only
 * exposes branch as a right-panel filter, not a URL param), so bars render
 * inert (OPEN_QUESTIONS: vacancies page has no branch intent).
 * A non-null branch_id whose Location record is gone still arrives with
 * whatever label the server put on it (cannot be re-keyed client-side) —
 * see OPEN_QUESTIONS for the CMBE ask on a sentinel/marker.
 */
import { useTranslation } from 'react-i18next'
import BarChartCard from '@/components/charts/BarChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import type { FillRateByBranchRow } from '@/types/dashboard'

export default function FillRateByBranchBar({ rows }: { rows: FillRateByBranchRow[] }) {
  const { t } = useTranslation('dashboard')
  const data = rows
    .filter(r => r.rate != null)
    .map(r => ({ name: r.branch_id == null ? t('feed.noBranch') : r.branch, value: r.rate as number }))

  if (!data.length) return null

  return (
    <Panel>
      <BarChartCard title={t('block.fillRateByBranch')} data={data} percentValues />
    </Panel>
  )
}
