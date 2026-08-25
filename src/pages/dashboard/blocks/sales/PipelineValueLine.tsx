/**
 * PipelineValueLine — sales_manager tile: pipeline value over time, from
 * dash.pipeline_value_timeseries. Inert: no reports-page intent for this
 * timeseries was measured for this lane (see OPEN_QUESTIONS).
 */
import { useTranslation } from 'react-i18next'
import LineChartCard from '@/components/charts/LineChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { useDateFormat } from '@/lib/datetime'
import { eur } from '@/pages/dashboard/dashboardFormat'
import type { PipelineValuePoint } from '@/types/dashboard'

export default function PipelineValueLine({ rows }: { rows: PipelineValuePoint[] }) {
  const { t } = useTranslation('dashboard')
  const { formatDate } = useDateFormat()

  // Short day/month label per point (DD-MM per §3B DATUM-1, house formatter only).
  const data = rows.map(p => ({ name: formatDate(p.date, { day: '2-digit', month: '2-digit' }), value: p.value }))

  return (
    <Panel>
      {/* One currency face on the whole sales dashboard — shared with OppsStalledTable. */}
      <LineChartCard title={t('block.pipelineValueTimeseries')} data={data} formatValue={eur} />
    </Panel>
  )
}
