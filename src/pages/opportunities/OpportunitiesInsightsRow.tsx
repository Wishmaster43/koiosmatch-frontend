import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import type { Opportunity } from '@/types/opportunity'

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
  stage: string[]
  owner: string[]
  onPickStage: (d: unknown) => void
  onClearStage: () => void
  onPickOwner: (d: unknown) => void
  onClearOwner: () => void
}

// OpportunitiesInsightsRow — config-driven KPI strip: two click-to-filter donuts
// (stage · owner) + three KPI cards (count · pipeline value · average value).
export default function OpportunitiesInsightsRow({
  rows, stage, owner, onPickStage, onClearStage, onPickOwner, onClearOwner,
}: OpportunitiesInsightsRowProps) {
  const { t } = useTranslation('opportunities')

  // Aggregate donuts + money KPIs from the full (unfiltered) row set.
  const { stageData, ownerData, total, pipeline, avg } = useMemo(() => {
    const withValue = rows.filter(r => typeof r.value === 'number')
    const sum = withValue.reduce((s, r) => s + (r.value ?? 0), 0)
    return {
      stageData: groupBy(rows, r => r.stage, r => r.stageColor),
      ownerData: groupBy(rows, r => r.owner),
      total:     rows.length,
      pipeline:  Math.round(sum),
      avg:       withValue.length ? Math.round(sum / withValue.length) : 0,
    }
  }, [rows])

  const donuts: DonutSpec[] = [
    { key: 'stage', title: t('insights.stage'), data: stageData, onPick: onPickStage, active: stage.length > 0, onClear: onClearStage },
    { key: 'owner', title: t('insights.owner'), data: ownerData, onPick: onPickOwner, active: owner.length > 0, onClear: onClearOwner },
  ]
  const kpis: KpiSpec[] = [
    { key: 'total',    label: t('kpi.total'),    value: total,    color: 'var(--color-primary)' },
    { key: 'pipeline', label: t('kpi.pipeline'), value: pipeline, color: 'var(--color-success)' },
    { key: 'avg',      label: t('kpi.avg'),      value: avg,      color: 'var(--text)' },
  ]

  return <InsightsRow donuts={donuts} kpis={kpis} clearTitle={t('insights.clearFilter')} />
}
