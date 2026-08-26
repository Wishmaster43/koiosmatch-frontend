/**
 * UsageDailyTable (BILLING-USAGE-REDESIGN-1) — the day- or week-granularity usage
 * table, shared DataTable (sorting lives there, §3A). A row click routes to the
 * same day-drilldown as a chart bar click; week rows are not individually
 * clickable (mirrors UsageDayChart's own day-only drill-in — a week has no single
 * day to open).
 */
import { useTranslation } from 'react-i18next'
import { useNumberFormat } from '@/lib/formatters'
import { useDateFormat } from '@/lib/datetime'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import type { DailyRow } from './dailyUsageTypes'
import type { WeekRow } from './weekAggregation'
import type { UsageGranularity } from './UsageDayChart'

interface UsageDailyTableProps {
  granularity: UsageGranularity
  dayRows: DailyRow[]
  weekRows: WeekRow[]
  onSelectDate: (date: string) => void
}

// The day- or week-granularity usage table; only day rows are individually
// clickable (a week has no single day to drill into).
export default function UsageDailyTable({ granularity, dayRows, weekRows, onSelectDate }: UsageDailyTableProps) {
  const { t } = useTranslation('settings')
  const { formatNumber, formatCurrency } = useNumberFormat()
  const { formatDate } = useDateFormat()

  const dayColumns: Column<DailyRow>[] = [
    { key: 'date', header: t('billing.usage.daily.colDate'), sortable: true, render: (r) => formatDate(r.date) },
    { key: 'workflowCredits', header: t('billing.usage.daily.colWorkflowCredits'), align: 'right', sortable: true, render: (r) => formatNumber(r.workflowCredits) },
    { key: 'workflowAmount', header: t('billing.usage.daily.colWorkflowAmount'), align: 'right', sortable: true, render: (r) => formatCurrency(r.workflowAmount) },
    { key: 'aiTokens', header: t('billing.usage.daily.colAiTokens'), align: 'right', sortable: true, sortValue: (r) => r.aiInputTokens + r.aiOutputTokens, render: (r) => formatNumber(r.aiInputTokens + r.aiOutputTokens) },
    { key: 'aiAmount', header: t('billing.usage.daily.colAiAmount'), align: 'right', sortable: true, render: (r) => formatCurrency(r.aiAmount) },
    { key: 'totalAmount', header: t('billing.usage.daily.colTotalAmount'), align: 'right', sortable: true, render: (r) => formatCurrency(r.totalAmount) },
  ]

  const weekColumns: Column<WeekRow>[] = [
    { key: 'weekKey', header: t('billing.usage.daily.colDate'), sortable: true, render: (r) => t('billing.usage.daily.weekLabel', { n: r.weekNumber }) },
    { key: 'workflowCredits', header: t('billing.usage.daily.colWorkflowCredits'), align: 'right', sortable: true, render: (r) => formatNumber(r.workflowCredits) },
    { key: 'workflowAmount', header: t('billing.usage.daily.colWorkflowAmount'), align: 'right', sortable: true, render: (r) => formatCurrency(r.workflowAmount) },
    { key: 'aiTokens', header: t('billing.usage.daily.colAiTokens'), align: 'right', sortable: true, sortValue: (r) => r.aiInputTokens + r.aiOutputTokens, render: (r) => formatNumber(r.aiInputTokens + r.aiOutputTokens) },
    { key: 'aiAmount', header: t('billing.usage.daily.colAiAmount'), align: 'right', sortable: true, render: (r) => formatCurrency(r.aiAmount) },
    { key: 'totalAmount', header: t('billing.usage.daily.colTotalAmount'), align: 'right', sortable: true, render: (r) => formatCurrency(r.totalAmount) },
  ]

  if (granularity === 'week') {
    return (
      <DataTable
        columns={weekColumns}
        rows={weekRows}
        getRowId={(r: WeekRow) => r.weekKey}
        emptyText={t('billing.usage.daily.empty')}
      />
    )
  }

  return (
    <DataTable
      columns={dayColumns}
      rows={dayRows}
      getRowId={(r: DailyRow) => r.date}
      onRowClick={(r: DailyRow) => onSelectDate(r.date)}
      emptyText={t('billing.usage.daily.empty')}
    />
  )
}
