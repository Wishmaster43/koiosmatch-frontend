/**
 * FillRateByBranchBar — ops tile: vacancy fill rate per branch
 * (dash.fill_rate_by_branch). The server already emits the rate as a 0..100
 * percentage (FillRateSeries.php:81), so the chart is plotted with
 * percentValues, never showPercent (which would re-derive a share of the sum).
 * Rows with a null rate carry no cohort to chart and are skipped. A bar with
 * a non-null branch_id drills into the vacancies page's branch filter
 * (VESTIGING-2); the no-branch bar stays inert (branchId null is guarded
 * below, since BarChartCard's onBarClick is chart-wide).
 */
import { useTranslation } from 'react-i18next'
import BarChartCard from '@/components/charts/BarChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import type { FillRateByBranchRow } from '@/types/dashboard'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type { FeedTileContext } from '../feedTileKit'

// Fill-rate-per-branch bar; a real branch bar drills into the vacancies page filtered on it, the no-branch bucket stays inert.
export default function FillRateByBranchBar({ rows, onNavigate }: {
  rows: FillRateByBranchRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  // branchId travels alongside the chart datum so the click handler can drill.
  const data = rows
    .filter(r => r.rate != null)
    .map(r => ({ name: r.branch_id == null ? t('feed.noBranch') : r.branch, value: r.rate as number, branchId: r.branch_id }))

  if (!data.length) return null

  // Only the-no-branch bar (branchId null) stays inert; a real branch drills
  // into the vacancies page filtered on it.
  const handleBarClick = onNavigate
    ? (d: ChartDatum) => { const branchId = d.branchId as string | null | undefined; if (branchId != null) onNavigate('vacancies', { branch: branchId }) }
    : undefined

  return (
    <Panel>
      <BarChartCard title={t('block.fillRateByBranch')} data={data} percentValues onBarClick={handleBarClick} />
    </Panel>
  )
}
