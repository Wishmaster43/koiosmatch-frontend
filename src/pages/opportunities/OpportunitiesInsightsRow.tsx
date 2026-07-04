import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import type { Opportunity } from '@/types/opportunity'
import type { LookupOption } from '@/types/common'

interface Aggregate { name: string; key: string; value: number; color?: string }

// Group rows into donut segments [{ name, key, value, color? }] by a field accessor.
function groupBy<T>(rows: T[], getLabel: (r: T) => string, getColor?: (r: T) => string | null): Aggregate[] {
  const m: Record<string, Aggregate> = {}
  rows.forEach(r => {
    const label = getLabel(r)
    if (!label) return
    m[label] ??= { name: label, key: label, value: 0, color: getColor?.(r) ?? undefined }
    m[label].value++
  })
  return Object.values(m)
}

interface OpportunitiesInsightsRowProps {
  rows: Opportunity[]
  stages: LookupOption[]
  // Tenant setting: show the deal magnitude in hours instead of euro.
  valueInHours: boolean
  stage: string[]
  owner: string[]
  client: string[]
  onPickStage: (d: unknown) => void
  onClearStage: () => void
  onPickOwner: (d: unknown) => void
  onClearOwner: () => void
  onPickClient: (d: unknown) => void
  onClearClient: () => void
}

/**
 * OpportunitiesInsightsRow — config-driven KPI strip mirroring the candidate footprint:
 * 3 click-to-filter donuts (Fase · Eigenaar · Klant) + 6 KPI cards (Open · Pijplijn ·
 * Gem. · Gewonnen · Verloren · Winratio). The value magnitude follows the tenant
 * setting (euro vs hours); won/lost derive from the stage lookup flags (is_won/is_lost).
 */
export default function OpportunitiesInsightsRow({
  rows, stages, valueInHours, stage, owner, client,
  onPickStage, onClearStage, onPickOwner, onClearOwner, onPickClient, onClearClient,
}: OpportunitiesInsightsRowProps) {
  const { t } = useTranslation('opportunities')

  const { stageData, ownerData, clientData, open, pipeline, avg, won, lost, winRate } = useMemo(() => {
    // Terminal stages from the lookup flags — outcome is never hardcoded.
    const wonStage  = stages.find(s => s.isWon)
    const lostStage = stages.find(s => s.isLost)
    const isWonRow  = (r: Opportunity) => !!wonStage  && r.stageValue === wonStage.value
    const isLostRow = (r: Opportunity) => !!lostStage && r.stageValue === lostStage.value
    // Deal magnitude field follows the €/hours setting.
    const magnitude = (r: Opportunity) => valueInHours ? r.hours : r.value
    const withMag = rows.filter(r => typeof magnitude(r) === 'number')
    const sum = withMag.reduce((s, r) => s + (magnitude(r) ?? 0), 0)
    const wonCount  = rows.filter(isWonRow).length
    const lostCount = rows.filter(isLostRow).length
    return {
      stageData:  groupBy(rows, r => r.stage, r => r.stageColor),
      ownerData:  groupBy(rows, r => r.owner),
      clientData: groupBy(rows, r => r.client),
      open:     rows.filter(r => !isWonRow(r) && !isLostRow(r)).length,
      pipeline: Math.round(sum),
      avg:      withMag.length ? Math.round(sum / withMag.length) : 0,
      won:      wonCount,
      lost:     lostCount,
      winRate:  (wonCount + lostCount) ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0,
    }
  }, [rows, stages, valueInHours])

  // `picked` doubles as the visible filter-chip label (on this page labels ARE the keys).
  const donuts: DonutSpec[] = [
    { key: 'stage',  title: t('insights.stage'),  data: stageData,  onPick: onPickStage,  active: stage.length > 0,  onClear: onClearStage,  picked: stage[0] ?? null },
    { key: 'owner',  title: t('insights.owner'),  data: ownerData,  onPick: onPickOwner,  active: owner.length > 0,  onClear: onClearOwner,  picked: owner[0] ?? null },
    { key: 'client', title: t('insights.client'), data: clientData, onPick: onPickClient, active: client.length > 0, onClear: onClearClient, picked: client[0] ?? null },
  ]
  const kpis: KpiSpec[] = [
    { key: 'open',     label: t('kpi.open'),                                   value: open,     color: 'var(--color-primary)' },
    { key: 'pipeline', label: t(valueInHours ? 'kpi.pipelineHours' : 'kpi.pipeline'), value: pipeline, color: 'var(--color-success)' },
    { key: 'avg',      label: t(valueInHours ? 'kpi.avgHours' : 'kpi.avg'),    value: avg,      color: 'var(--text)' },
    { key: 'won',      label: t('kpi.won'),                                    value: won,      color: 'var(--color-success)' },
    { key: 'lost',     label: t('kpi.lost'),                                   value: lost,     color: 'var(--color-danger)' },
    { key: 'winrate',  label: t('kpi.winRate'),                                value: winRate,  color: 'var(--color-warning)' },
  ]

  return <InsightsRow donuts={donuts} kpis={kpis} clearTitle={t('insights.clearFilter')} />
}
