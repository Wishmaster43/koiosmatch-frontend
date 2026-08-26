/**
 * ProductivityByRecruiterBars — recruitment_manager work-feed tile: submissions
 * vs placements per recruiter over the last 30 days (dash.productivity_by_recruiter),
 * grouped bars via the shared WeeklyBarChartCard. Click a bar → that recruiter's
 * candidates (owner filter).
 */
import { useTranslation } from 'react-i18next'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import type { BarSeries } from '@/components/charts/WeeklyBarChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import type { ProductivityByRecruiterRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// Recruitment-manager work-feed tile (see the module doc above): renders nothing when there are no rows, and a bar click filters candidates by that recruiter as owner.
export default function ProductivityByRecruiterBars({ rows, onNavigate }: {
  rows: ProductivityByRecruiterRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  if (!rows.length) return null

  // One bar-chart row per recruiter, carrying the userId for the click handler.
  // `value` satisfies ChartDatum's base shape; the chart itself reads the series keys.
  const data = rows.map(r => ({ name: r.name || t('widget.unknown'), value: r.proposals, proposals: r.proposals, placements: r.placements, userId: r.user_id }))
  const series: BarSeries[] = [
    { key: 'proposals', label: t('feed.series.proposals'), color: 'var(--color-primary)' },
    { key: 'placements', label: t('feed.series.placements'), color: 'var(--color-secondary)' },
  ]

  return (
    <Panel>
      <WeeklyBarChartCard
        title={t('block.productivityByRecruiter')}
        data={data}
        series={series}
        onBarClick={(row) => {
          const userId = (row as { userId?: string }).userId
          if (userId) onNavigate?.('candidates', { owner: userId })
        }}
      />
    </Panel>
  )
}
