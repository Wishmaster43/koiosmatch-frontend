/**
 * OppsByStageByOwnerStacked — sales_manager tile: opportunities grouped by
 * stage, stacked per owner, from dash.opps_by_stage_by_owner. One bar per
 * stage, one stacked series per owner (union across all stages, keyed on
 * owner_id ?? 'none'). Clicking a bar segment filters the opportunities page
 * on that stage AND that owner id — the opportunities page's owner filter now
 * keys on owner id, so a real owner series narrows both axes; the synthetic
 * 'none' (unassigned) series has no owner id to filter on, so it narrows on
 * stage only.
 */
import { useTranslation } from 'react-i18next'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import type { BarSeries } from '@/components/charts/WeeklyBarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { OppsByStageByOwnerRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function OppsByStageByOwnerStacked({ rows, onNavigate }: {
  rows: OppsByStageByOwnerRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  // LOOKUP-I18N-1: the seeded stage label renders in the user's language.
  const seedLabel = useSeedLabel()

  // Union of owners across every stage, in first-seen order, so series stay
  // stable regardless of which stage lists them first.
  const ownerKeys: string[] = []
  const ownerLabels: Record<string, string> = {}
  rows.forEach(stage => stage.by_owner.forEach(o => {
    const key = o.owner_id ?? 'none'
    if (!ownerKeys.includes(key)) {
      ownerKeys.push(key)
      ownerLabels[key] = o.owner_id == null ? t('feed.unassigned') : (o.name || t('widget.unknown'))
    }
  }))

  const series: BarSeries[] = ownerKeys.map((key, i) => ({
    key, label: ownerLabels[key], color: CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
  }))

  // One row per stage; each owner's count lands in its own series field.
  const data = rows.map(stage => {
    // `value` is unused by the grouped/stacked bars (each series reads its own
    // owner key) but is required by the shared ChartDatum shape.
    const row: Record<string, unknown> = { name: seedLabel('opportunityStages', { value: stage.stage_id, label: stage.stage_label }), value: 0, stageId: stage.stage_id }
    ownerKeys.forEach(key => { row[key] = 0 })
    stage.by_owner.forEach(o => { row[o.owner_id ?? 'none'] = o.count })
    return row
  }) as ChartDatum[]

  return (
    <Panel>
      <WeeklyBarChartCard
        title={t('block.oppsByStageByOwner')}
        data={data}
        series={series}
        stacked
        onBarClick={(row, series) => {
          const stageId = (row as { stageId?: string }).stageId
          if (stageId == null) return
          // The synthetic 'none' series (unassigned) has no owner id to filter
          // on — narrow by stage only; a real owner series narrows both.
          if (series.key === 'none') onNavigate?.('opportunities', { stage: stageId })
          else onNavigate?.('opportunities', { stage: stageId, owner: series.key })
        }}
      />
    </Panel>
  )
}
