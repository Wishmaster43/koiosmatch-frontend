/**
 * CallsPerRecruiterBar — daily calls per recruiter against the daily target
 * (kpi_targets.daily_calls_target.per_recruiter). A recruiter bar opens the
 * call-lists page filtered on that recruiter; the unassigned bar is informational.
 */
import { useTranslation } from 'react-i18next'
import BarChartCard from '@/components/charts/BarChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { useNumberFormat } from '@/lib/formatters'
import { perRecruiterRows } from '@/pages/dashboard/kpiTargets'
import type { KpiTarget } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// Renders nothing without rows; below-target bars use the warning token, the rest the primary chart colour.
export default function CallsPerRecruiterBar({ entry, onNavigate }: {
  entry: KpiTarget | undefined
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { formatNumber } = useNumberFormat()
  const rows = perRecruiterRows(entry)
  if (!rows.length) return null

  // Axis label = the name; the "value / target" ratio rides in the tooltip (sub); userId/userName drive the click.
  const data = rows.map(r => ({
    name: r.user_id == null ? t('chart.unassigned') : r.name,
    sub: `${formatNumber(r.value)} / ${formatNumber(r.target)}`,
    value: r.value, userId: r.user_id, userName: r.name,
  }))
  const colors = rows.map(r => (r.below ? 'var(--color-warning)' : 'var(--color-primary)'))

  return (
    <Panel>
      <BarChartCard
        title={t('block.callsPerRecruiter')}
        data={data}
        colors={colors}
        onBarClick={(d) => {
          const { userId, userName } = d as { userId?: string | null; userName?: string }
          if (userId) onNavigate?.('outreach', { owner: userId, ownerName: userName })
        }}
      />
    </Panel>
  )
}
