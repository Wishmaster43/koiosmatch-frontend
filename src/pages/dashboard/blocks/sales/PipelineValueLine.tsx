/**
 * PipelineValueLine — sales_manager tile: pipeline value over time, from
 * dash.pipeline_value_timeseries. A point click opens the opportunities
 * analytical report (the reports lane owns seeding its own filter from the
 * intent; this tile only sends the report id).
 */
import { useTranslation } from 'react-i18next'
import LineChartCard from '@/components/charts/LineChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { useDateFormat } from '@/lib/datetime'
import { eur } from '@/pages/dashboard/dashboardFormat'
import type { PipelineValuePoint } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// Sales-manager tile (see the module doc above): a point click only sends the report id, the reports lane seeds its own filter from that intent.
export default function PipelineValueLine({ rows, onNavigate }: {
  rows: PipelineValuePoint[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { locale } = useDateFormat()

  // The ISO date is the category; the chart renders DD-MM ticks and a DD-MM-YYYY tooltip (AXIS-TICK-DATE-1).
  const data = rows.map(p => ({ name: p.date, value: p.value }))

  return (
    <Panel>
      {/* One currency face on the whole sales dashboard — shared with OppsStalledTable. */}
      <LineChartCard
        title={t('block.pipelineValueTimeseries')}
        data={data}
        dateAxis
        formatValue={v => eur(v, locale)}
        onItemClick={onNavigate ? () => onNavigate('reports', { report: 'opportunities' }) : undefined}
      />
    </Panel>
  )
}
