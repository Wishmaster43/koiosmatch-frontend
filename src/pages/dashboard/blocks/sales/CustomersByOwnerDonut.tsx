/**
 * CustomersByOwnerDonut — sales_manager work-feed tile: the tenant-wide "where
 * does business come from" breakdown (dash.customers_by_owner), replacing the
 * old WidgetListBlock row (DASH-FEEDS-V3 / feedRegistry.ts). Its registry entry
 * lives in ./index.tsx (tile files export only their component).
 */
import { useTranslation } from 'react-i18next'
import PieChartCard from '@/components/charts/PieChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { fv } from '@/pages/dashboard/dashboardFormat'
import type { DashData } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function CustomersByOwnerDonut({ dash, onNavigate }: {
  dash: DashData
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  // A null owner_id → the tenant "unassigned" label, never the server's Dutch
  // literal; a present id with an empty name still falls back to Unknown.
  const data = (dash.customers_by_owner ?? []).map(c => ({
    name: c.owner_id == null ? t('feed.unassigned') : (c.name || t('widget.unknown')),
    value: c.count ?? 0, filterValue: c.owner_id,
  }))
  return (
    <Panel>
      <PieChartCard
        title={t('block.customersByOwner')}
        data={data}
        colors={CHART_SERIES_COLORS}
        onItemClick={d => { const v = fv(d); if (v != null) onNavigate?.('customers', { owner: v }) }}
        // The unassigned slice (no owner_id) is a synthetic remainder bucket, not a drillable owner.
        isInert={d => d.filterValue == null}
      />
    </Panel>
  )
}
