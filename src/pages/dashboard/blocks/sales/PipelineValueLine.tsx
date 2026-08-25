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

export default function PipelineValueLine({ rows, onNavigate }: {
  rows: PipelineValuePoint[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()

  // Short day/month label per point (DD-MM per §3B DATUM-1, house formatter only).
  const data = rows.map(p => ({ name: formatDate(p.date, { day: '2-digit', month: '2-digit' }), value: p.value }))

  return (
    <Panel>
      {/* One currency face on the whole sales dashboard — shared with OppsStalledTable. */}
      <LineChartCard
        title={t('block.pipelineValueTimeseries')}
        data={data}
        formatValue={eur}
        onItemClick={onNavigate ? () => onNavigate('reports', { report: 'opportunities' }) : undefined}
      />
    </Panel>
  )
}
