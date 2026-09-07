/**
 * UsagePerActivityPerDayChart (B-27) — day × activity breakdown using the shared
 * WeeklyBarChartCard, stacked by activity. Reuses the existing chart atoms, no
 * new chart library. Four UI states: loading, error, empty, ready.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import { SectionTitle } from '@/components/ui/typography'
import { card, sub, notice } from '../usageCardStyles'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type { BillingUsageWorkflow } from '@/types/billingUsage'

interface UsagePerActivityPerDayChartProps {
  workflow: BillingUsageWorkflow | undefined
  phase: 'loading' | 'ready' | 'empty' | 'error'
}

// Activity label translation fallback — activity codes are backend slugs, translated via the existing activity map key.
function activityLabel(t: (k: string, o?: Record<string, unknown>) => string, code: string): string {
  return t(`billing.usage.activity.activityMap.${code}`, { defaultValue: code })
}

// Day × activity breakdown chart: stacks activities into daily bars.
export default function UsagePerActivityPerDayChart({ workflow, phase }: UsagePerActivityPerDayChartProps) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()

  // Transform per_activity_per_day into chart format: group by date, nest activities as series.
  const chartData = useMemo((): ChartDatum[] => {
    const rows = workflow?.per_activity_per_day ?? []
    if (rows.length === 0) return []

    // Group by date, collecting activities and their credits.
    const byDate = new Map<string, Map<string, number>>()
    rows.forEach((row) => {
      if (!byDate.has(row.date)) byDate.set(row.date, new Map())
      const activities = byDate.get(row.date)!
      activities.set(row.activity, (activities.get(row.activity) ?? 0) + (row.credits ?? 0))
    })

    // Convert to chart data: one bar per date, with activity totals as properties.
    return Array.from(byDate.entries()).map(([date, activities]) => {
      const result: Record<string, unknown> = {
        name: formatDate(date),
        key: date,
        value: 0,
      }
      let total = 0
      activities.forEach((credits, activity) => {
        result[activity] = credits
        total += credits
      })
      result.value = total
      return result as ChartDatum
    })
  }, [workflow?.per_activity_per_day, formatDate])

  // Extract unique activities and assign colours — one colour per activity.
  const activities = useMemo(() => {
    const rows = workflow?.per_activity_per_day ?? []
    const unique = new Set<string>()
    rows.forEach((row) => unique.add(row.activity))
    return Array.from(unique)
  }, [workflow?.per_activity_per_day])

  const chartSeries = useMemo(() => {
    return activities.map((activity, i) => {
      // Cycle through primary colours — using the same token-based approach as the daily chart.
      const colors = [
        'var(--color-primary)',
        'var(--color-info, var(--color-primary))',
        'var(--color-success, var(--color-primary))',
        'var(--color-warning, var(--color-primary))',
      ]
      return {
        key: activity,
        label: activityLabel(t, activity),
        color: colors[i % colors.length],
      }
    })
  }, [activities, t])

  return (
    <div style={card}>
      <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.activityPerDay.title')}</SectionTitle>
      <div style={sub}>{t('billing.usage.activityPerDay.subtitle')}</div>

      {phase === 'loading' && <p style={notice}>{t('common.loadingShort')}</p>}
      {phase === 'error' && <p style={notice}>{t('billing.usage.activityPerDay.loadError')}</p>}
      {phase === 'empty' && <p style={notice}>{t('billing.usage.activityPerDay.empty')}</p>}
      {phase === 'ready' && chartData.length > 0 && (
        <div>
          <WeeklyBarChartCard data={chartData} series={chartSeries} height={240} />
        </div>
      )}
    </div>
  )
}
