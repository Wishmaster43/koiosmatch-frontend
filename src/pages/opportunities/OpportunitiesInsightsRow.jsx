import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '../../components/insights/InsightsRow'

// Group rows into donut segments [{ name, key, value, color? }] by a field accessor.
function groupBy(rows, getLabel, getColor) {
  const m = {}
  rows.forEach(r => {
    const label = getLabel(r)
    if (!label) return
    m[label] ??= { name: label, key: label, value: 0, color: getColor?.(r) }
    m[label].value++
  })
  return Object.values(m)
}

// OpportunitiesInsightsRow — config-driven KPI strip: two click-to-filter donuts
// (stage · owner) + three KPI cards (count · pipeline value · average value). All
// figures derive from the loaded rows so the strip works before a stats endpoint
// exists; once GET /opportunities/stats lands, swap the aggregates for server totals.
export default function OpportunitiesInsightsRow({
  rows, stage, owner, onPickStage, onClearStage, onPickOwner, onClearOwner,
}) {
  const { t } = useTranslation('opportunities')

  // Aggregate donuts + money KPIs from the full (unfiltered) row set.
  const { stageData, ownerData, total, pipeline, avg } = useMemo(() => {
    const withValue = rows.filter(r => typeof r.value === 'number')
    const sum = withValue.reduce((s, r) => s + r.value, 0)
    return {
      stageData: groupBy(rows, r => r.stage, r => r.stageColor),
      ownerData: groupBy(rows, r => r.owner),
      total:     rows.length,
      pipeline:  Math.round(sum),
      avg:       withValue.length ? Math.round(sum / withValue.length) : 0,
    }
  }, [rows])

  const donuts = [
    { key: 'stage', title: t('insights.stage'), data: stageData, onPick: onPickStage, active: stage.length > 0, onClear: onClearStage },
    { key: 'owner', title: t('insights.owner'), data: ownerData, onPick: onPickOwner, active: owner.length > 0, onClear: onClearOwner },
  ]
  const kpis = [
    { key: 'total',    label: t('kpi.total'),    value: total,    color: 'var(--color-primary)' },
    { key: 'pipeline', label: t('kpi.pipeline'), value: pipeline, color: 'var(--color-success)' },
    { key: 'avg',      label: t('kpi.avg'),      value: avg,      color: 'var(--text)' },
  ]

  return <InsightsRow donuts={donuts} kpis={kpis} clearTitle={t('insights.clearFilter')} />
}
