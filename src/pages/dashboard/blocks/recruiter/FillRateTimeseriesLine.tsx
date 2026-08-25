/**
 * FillRateTimeseriesLine — recruitment_manager work-feed tile: fill rate over
 * the last 14 days (dash.fill_rate_timeseries). Days with no cohort (rate ===
 * null) carry no meaningful percentage and are skipped rather than plotted as 0.
 * No report intent exists yet for this cohort (measured: ReportsPage.tsx has no
 * dashboard→report drill param) so the chart is currently inert on click; see
 * OPEN_QUESTIONS in the delivery report.
 */
import { useTranslation } from 'react-i18next'
import LineChartCard from '@/components/charts/LineChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { useDateFormat } from '@/lib/datetime'
import type { FillRatePoint } from '@/types/dashboard'

export default function FillRateTimeseriesLine({ rows }: { rows: FillRatePoint[] }) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()
  // Skip days with no cohort — a null rate has nothing to plot, not a zero.
  const data = rows
    .filter(p => p.rate != null)
    .map(p => ({ name: formatDate(p.date, { day: '2-digit', month: '2-digit' }), value: Math.round(p.rate as number) }))
  if (!data.length) return null

  return (
    <Panel>
      <LineChartCard title={t('block.fillRateTimeseries')} data={data} unit="%" />
    </Panel>
  )
}
