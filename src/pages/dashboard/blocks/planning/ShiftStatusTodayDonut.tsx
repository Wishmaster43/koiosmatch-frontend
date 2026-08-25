/**
 * ShiftStatusTodayDonut — planning work-feed tile: today's shift statuses as a
 * donut, each slice tinted by its own status colour; an unmapped status falls
 * back to the shared chart series palette so it never renders uncoloured.
 */
import { useTranslation } from 'react-i18next'
import PieChartCard from '@/components/charts/PieChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import type { ShiftStatusTodayRow } from '@/types/dashboard'

// One fixed colour per status token (§4: colour carries meaning, not decoration).
const STATUS_COLOR: Record<string, string> = {
  planned: 'var(--color-primary)',
  confirmed: 'var(--color-success)',
  completed: 'var(--color-secondary)',
  cancelled: 'var(--color-warning)',
  no_show: 'var(--color-danger)',
}

export default function ShiftStatusTodayDonut({ rows, onNavigate }: {
  rows: ShiftStatusTodayRow[]
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  // Drop zero slices; unknown statuses fall back to the shared "unknown" label.
  const data = rows.filter(r => r.count > 0).map((r, i) => ({
    name: t(`feed.shiftStatus.${r.status}`, { defaultValue: t('widget.unknown') }),
    value: r.count,
    color: STATUS_COLOR[r.status] ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
  }))

  return (
    <Panel>
      <PieChartCard
        title={t('block.shiftStatusToday')}
        data={data}
        colors={data.map(d => d.color)}
        onItemClick={() => onNavigate?.('planning')}
      />
    </Panel>
  )
}
