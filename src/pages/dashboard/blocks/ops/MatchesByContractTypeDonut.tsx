/**
 * MatchesByContractTypeDonut — ops tile: matches broken down by contract type
 * (dash.matches_by_contract_type). The matches page has no contract-type
 * intent yet, so every slice click is a broad drill to the matches list
 * (OPEN_QUESTIONS: a narrowed click needs that intent added).
 */
import { useTranslation } from 'react-i18next'
import PieChartCard from '@/components/charts/PieChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import type { MatchesByContractTypeRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function MatchesByContractTypeDonut({ rows, onNavigate }: {
  rows: MatchesByContractTypeRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  // Zero-count slices carry no useful drill target — drop them before charting.
  const data = rows
    .filter(r => r.count > 0)
    .map((r, i) => ({
      name: r.value === 'none' ? t('widget.unknown') : r.label,
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
        // No contract-type intent exists on the matches page yet: broad drill by design.
        // Only wired when onNavigate is actually provided, so slices don't render clickable for nothing.
        onItemClick={onNavigate ? () => onNavigate('matches') : undefined}
      />
    </Panel>
  )
}
