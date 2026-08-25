/**
 * CustomersByPhaseDonut — accountmanager work-feed tile (dash.customers_by_phase):
 * customer count per lifecycle phase (prospect/klant/…). Colours come from the
 * tenant's customer-phase lookup when the server row's value matches, otherwise
 * fall back to the house chart series. Zero-count phases are dropped from the
 * donut. Its registry entry lives in ./index.tsx.
 */
import { useTranslation } from 'react-i18next'
import PieChartCard from '@/components/charts/PieChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { fv } from '@/pages/dashboard/dashboardFormat'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { CustomerByPhaseRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function CustomersByPhaseDonut({ rows, onNavigate }: {
  rows: CustomerByPhaseRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  const { phases } = useCustomerPhases()
  // LOOKUP-I18N-1: the seeded phase label renders in the user's language.
  const seedLabel = useSeedLabel()

  // Drop zero-count phases; colour from the tenant lookup match, else the house series.
  const nonEmpty = rows.filter(r => r.count > 0)
  const data = nonEmpty.map((r, i) => ({
    name: seedLabel('customerPhases', { value: r.value, label: r.label }), value: r.count, filterValue: r.value,
    color: phases.find(p => p.value === r.value)?.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
  }))

  return (
    <Panel>
      <PieChartCard
        title={t('block.customersByPhase')}
        data={data}
        colors={data.map(d => d.color)}
        onItemClick={onNavigate ? d => { const v = fv(d); if (v != null) onNavigate('customers', { phase: v }) } : undefined}
      />
    </Panel>
  )
}
