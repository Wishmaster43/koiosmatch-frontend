/**
 * MatchesByContractTypeDonut — ops tile: matches broken down by contract TYPE
 * (dash.matches_by_contract_type, OpsPlanningFeeds.php grouped over the
 * ContractType lookup). MATCH-AXIS-FIX: a real slice narrows the matches page
 * via the { contract_type } intent — a distinct axis from contract FORM; the
 * 'none' slice has no server filter value for "no contract type" so it keeps
 * the broad drill (see the click handler below).
 */
import { useTranslation } from 'react-i18next'
import PieChartCard from '@/components/charts/PieChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { fv } from '@/pages/dashboard/dashboardFormat'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { MatchesByContractTypeRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

// Ops dashboard tile: matches broken down by contract type; see the module doc
// comment above for why the 'none' slice drills broadly instead of by a filter value.
export default function MatchesByContractTypeDonut({ rows, onNavigate }: {
  rows: MatchesByContractTypeRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  // LOOKUP-I18N-1: the seeded contract-type label renders in the user's language.
  const seedLabel = useSeedLabel()
  // Zero-count slices carry no useful drill target — drop them before charting.
  // `filterValue` carries the raw contract_type (ContractType lookup) value the click needs (§ house convention, name is localised for display).
  const data = rows
    .filter(r => r.count > 0)
    .map((r, i) => ({
      name: r.value === 'none' ? t('widget.unknown') : seedLabel('contractTypes', { value: r.value, label: r.label }),
      filterValue: r.value,
      value: r.count,
      color: r.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
    }))

  if (!data.length) return null

  return (
    <Panel>
      <PieChartCard
        title={t('block.matchesByContractType')}
        data={data}
        colors={data.map(d => d.color)}
        // A real contract-type value narrows the matches page; 'none' has no server
        // filter value for "no contract type" so it stays a broad drill (§4 no guess).
        // Only wired when onNavigate is actually provided, so slices don't render clickable for nothing.
        onItemClick={onNavigate
          ? (d: unknown) => {
              const v = fv(d)
              if (v != null && v !== 'none') onNavigate('matches', { contract_type: v })
              else onNavigate('matches')
            }
          : undefined}
      />
    </Panel>
  )
}
