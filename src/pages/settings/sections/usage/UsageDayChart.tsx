/**
 * UsageDayChart (BILLING-USAGE-REDESIGN-1) — the big daily-usage bar chart, reusing
 * the shared WeeklyBarChartCard (no new chart component, per the brief). Carries
 * two inline SegmentedControls that are both VIEW choices of this one card, not a
 * second filter surface: `category` (Totaal|Workflow|Koios AI) picks which series
 * the bars/table show, `granularity` (Dag|Week) picks the FE-side rollup — neither
 * changes what data is fetched, only how the already-fetched period is displayed.
 * The real filter (period: this/previous month) stays registered in the right
 * panel by the parent, exactly once (no duplicate category group there anymore).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import SegmentedControl from '@/components/ui/SegmentedControl'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import { SectionTitle, Caption } from '@/components/ui/typography'
import type { DailyRow } from './dailyUsageTypes'
import type { WeekRow } from './weekAggregation'
import { card, sub } from '../usageCardStyles'

export type UsageCategory = 'total' | 'workflow' | 'ai'
export type UsageGranularity = 'day' | 'week'

interface UsageDayChartProps {
  rows: DailyRow[]
  // Pre-aggregated by the section (memoized once there) — never recomputed here.
  weekRows: WeekRow[]
  category: UsageCategory
  onCategoryChange: (c: UsageCategory) => void
  granularity: UsageGranularity
  onGranularityChange: (g: UsageGranularity) => void
  // Day-granularity bar click → drill down to that day; disabled in week view
  // (a week bar has no single day to drill into — see the header comment).
  onSelectDate: (date: string) => void
}

// The daily/weekly usage bar chart, with two view-only toggles (category,
// granularity) that reshape the already-fetched rows — never a second fetch.
export default function UsageDayChart({ rows, weekRows, category, onCategoryChange, granularity, onGranularityChange, onSelectDate }: UsageDayChartProps) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()


  // The chart datum's `name` is the visible label; `key` carries the row id used
  // to route a bar click back to a real date (day view) — week bars are unclickable.
  const chartData = useMemo(() => {
    if (granularity === 'week') {
      return weekRows.map(w => ({
        name: t('billing.usage.daily.weekLabel', { n: w.weekNumber }), key: w.weekKey, value: w.totalAmount,
        workflow: w.workflowAmount, ai: w.aiAmount, total: w.totalAmount,
      }))
    }
    return rows.map(r => ({
      name: formatDate(r.date), key: r.date, value: r.totalAmount,
      workflow: r.workflowAmount, ai: r.aiAmount, total: r.totalAmount,
    }))
  }, [rows, weekRows, granularity, formatDate, t])

  // The one series to plot for the picked category, each with its own label/colour.
  const chartSeries = useMemo(() => {
    if (category === 'workflow') return [{ key: 'workflow', label: t('billing.usage.daily.categoryWorkflow'), color: 'var(--color-primary)' }]
    if (category === 'ai') return [{ key: 'ai', label: t('billing.usage.daily.categoryAi'), color: 'var(--color-info, var(--color-primary))' }]
    return [{ key: 'total', label: t('billing.usage.daily.categoryTotal'), color: 'var(--color-primary)' }]
  }, [category, t])

  const handleBarClick = granularity === 'day'
    ? (row: unknown) => { const key = (row as { key?: string })?.key; if (key) onSelectDate(key) }
    : undefined

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <SectionTitle style={{ marginBottom: 4 }}>{t('billing.usage.daily.title')}</SectionTitle>
          <div style={sub}>{t('billing.usage.daily.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SegmentedControl
            size="compact"
            ariaLabel={t('billing.usage.daily.categoryLabel')}
            options={[
              { value: 'total', label: t('billing.usage.daily.categoryTotal') },
              { value: 'workflow', label: t('billing.usage.daily.categoryWorkflow') },
              { value: 'ai', label: t('billing.usage.daily.categoryAi') },
            ]}
            value={category}
            onChange={(v) => onCategoryChange(v as UsageCategory)}
          />
          <SegmentedControl
            size="compact"
            ariaLabel={t('billing.usage.daily.granularityLabel')}
            options={[
              { value: 'day', label: t('billing.usage.daily.granularityDay') },
              { value: 'week', label: t('billing.usage.daily.granularityWeek') },
            ]}
            value={granularity}
            onChange={(v) => onGranularityChange(v as UsageGranularity)}
          />
        </div>
      </div>

      <div style={{ marginBottom: 4 }}>
        <WeeklyBarChartCard data={chartData} series={chartSeries} height={240} onBarClick={handleBarClick} />
      </div>
      {granularity === 'day' && (
        <Caption>{t('billing.usage.daily.clickHint')}</Caption>
      )}
    </div>
  )
}
