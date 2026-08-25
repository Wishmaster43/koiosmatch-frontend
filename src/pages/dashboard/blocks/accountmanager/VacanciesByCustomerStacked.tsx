/**
 * VacanciesByCustomerStacked — accountmanager work-feed tile (dash.vacancies_by_customer):
 * one stacked bar per customer, one segment per vacancy status. The series set
 * is the UNION of every status_id/label seen across rows (a tenant lookup label,
 * so no translation needed for the series names themselves). Click a segment →
 * that customer's vacancies tab. Its registry entry lives in ./index.tsx.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import type { BarSeries } from '@/components/charts/WeeklyBarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { VacanciesByCustomerRow } from '@/types/dashboard'
import type { FeedTileContext } from '../feedTileKit'

export default function VacanciesByCustomerStacked({ rows, onNavigate }: {
  rows: VacanciesByCustomerRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  // LOOKUP-I18N-1: the seeded vacancy-status label renders in the user's language.
  const seedLabel = useSeedLabel()

  // Derive the series (one per distinct status_id) and the chart rows (one
  // numeric field per series key) in one pass over the customer rows.
  const { data, series } = useMemo(() => {
    const statusLabels = new Map<string, string>()
    const chartRows: ChartDatum[] = rows.map(row => {
      const point: ChartDatum = { name: row.name, customerId: row.customer_id, value: 0 }
      for (const s of row.by_status) {
        statusLabels.set(s.status_id, s.label)
        point[s.status_id] = s.count
      }
      return point
    })
    const barSeries: BarSeries[] = Array.from(statusLabels.entries()).map(([id, label], i) => ({
      key: id, label: seedLabel('vacancyStatuses', { value: id, label }), color: CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
    }))
    return { data: chartRows, series: barSeries }
  }, [rows, seedLabel])

  // Click any segment → the customer's vacancies tab. `row` is the chart
  // datum (carries the customer_id under `customerId`); recharts sometimes
  // hands back the raw bar rectangle instead, which nests the datum under
  // `payload`, so fall back to that shape too.
  const handleBarClick = (row: unknown) => {
    const flat = row as { customerId?: string; payload?: { customerId?: string } }
    const customerId = flat.customerId ?? flat.payload?.customerId
    if (customerId) onNavigate?.('customers', { open: customerId, tab: 'vacancies' })
  }

  return (
    <Panel>
      <WeeklyBarChartCard
        title={t('block.vacanciesByCustomer')}
        data={data}
        series={series}
        stacked
        onBarClick={handleBarClick}
      />
    </Panel>
  )
}
