/**
 * FillRateTimeseriesLine — recruitment_manager work-feed tile: fill rate over
 * the last 14 days (dash.fill_rate_timeseries). Days with no cohort (rate ===
 * null) carry no meaningful percentage and are skipped rather than plotted as 0.
 * DASH-REPORT-DEEPLINK-1: a point click opens the Vacancies report (the fill
 * rate is a vacancy-cohort metric) via the same `report` intent key the reports
 * hub reads (ReportsPage.tsx) — mirrors the sales lane's opportunities wiring.
 */
import { useTranslation } from 'react-i18next'
import LineChartCard from '@/components/charts/LineChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { useDateFormat } from '@/lib/datetime'
import type { FillRatePoint } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function FillRateTimeseriesLine({ rows, onNavigate }: {
  rows: FillRatePoint[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()
  // Skip days with no cohort — a null rate has nothing to plot, not a zero.
  const data = rows
    .filter(p => p.rate != null)
    .map(p => ({ name: formatDate(p.date, { day: '2-digit', month: '2-digit' }), value: Math.round(p.rate as number) }))
  if (!data.length) return null

  return (
    <Panel>
      <LineChartCard
        title={t('block.fillRateTimeseries')}
        data={data}
        unit="%"
        onItemClick={onNavigate ? () => onNavigate('reports', { report: 'vacancies' }) : undefined}
      />
    </Panel>
  )
}
