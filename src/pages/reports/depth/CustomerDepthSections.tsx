/**
 * CustomerDepthSections — the customers report's depth block (concentration,
 * churn, per-owner cohorts): four ReportChartCard cells the page inserts right
 * after the by_branch card (RAPPORT-DIEPTE-1). Every field is optional on
 * CustomersReportData (the compare envelope never carries it), so each section
 * self-hides when its own field is absent — never a fabricated empty chart.
 */
import { useTranslation } from 'react-i18next'
import ReportChartCard from '../ReportChartCard'
import { Caption } from '@/components/ui/typography'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type { CustomersReportData, ConcentrationRow } from '@/types/analytics'
import { useNumberFormat } from '@/lib/formatters'

// 'YYYY-MM' → 'MM-YYYY' (§3B DATUM-1: never a raw ISO fragment in JSX).
function formatMonth(ym: string): string {
  const [year, month] = ym.split('-')
  if (!year || !month) return ym
  return `${month}-${year}`
}

export default function CustomerDepthSections({ data, onOpenCustomer }: {
  data: CustomersReportData
  onOpenCustomer: (customerId: string) => void
}) {
  const { t } = useTranslation('analytics')
  // Locale-aware percentage share (FMT-PROCENT-1) — never a raw .toFixed().
  const { formatPercent } = useNumberFormat()

  // Concentration donut data: the synthetic 'others' row (customer_id null)
  // renders under its own label; `filterValue` carries the real customer id
  // (null for the synthetic row) so PieChartCard's isInert can mark it —
  // no role/tabIndex/cursor/click on that legend row (§3 no fake affordances).
  const concentrationSlices = (rows: ConcentrationRow[]): { data: ChartDatum[]; colors: string[] } => ({
    data: rows.map(r => ({ name: r.customer_id == null ? t('customers.depth.concentration.others') : r.name, value: r.count, key: r.customer_id ?? 'others', filterValue: r.customer_id })),
    colors: rows.map((_, i) => CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  })
  const pickConcentration = () => (d: unknown) => {
    const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
    if (!key || key === 'others') return
    onOpenCustomer(key)
  }
  // The synthetic 'others' bucket has no real customer to drill into.
  const isOthersInert = (d: ChartDatum) => (d as { filterValue?: unknown }).filterValue == null

  return (
    <>
      {/* Concentration — top 5 customers by placements and by vacancies. */}
      {data.concentration_top5 && (
        <>
          <ReportChartCard title={t('customers.depth.concentration.byPlacements')} chart={
            <>
              {data.concentration_top5.top5_share_placements_pct != null && (
                <Caption>{t('customers.depth.concentration.share', { pct: formatPercent(data.concentration_top5.top5_share_placements_pct) })}</Caption>
              )}
              <PieChartCard {...concentrationSlices(data.concentration_top5.by_placements)} showPercent
                onItemClick={pickConcentration()} isInert={isOthersInert} />
            </>
          } />
          <ReportChartCard title={t('customers.depth.concentration.byVacancies')} chart={
            <>
              {data.concentration_top5.top5_share_vacancies_pct != null && (
                <Caption>{t('customers.depth.concentration.share', { pct: formatPercent(data.concentration_top5.top5_share_vacancies_pct) })}</Caption>
              )}
              <PieChartCard {...concentrationSlices(data.concentration_top5.by_vacancies)} showPercent
                onItemClick={pickConcentration()} isInert={isOthersInert} />
            </>
          } />
        </>
      )}

      {/* Churn per month — fixed 12-month window, inert (standing counts, no drill target). */}
      {data.churn_trend && (
        <ReportChartCard title={t('customers.depth.churn.title')} chart={
          <>
            <Caption>{t('customers.depth.fixedWindow12')}</Caption>
            <BarChartCard data={data.churn_trend.map(m => ({ name: formatMonth(m.month), value: m.churned }))} />
          </>
        } />
      )}

      {/* New customers per account manager per month — fixed 6-month window, inert. */}
      {data.by_owner_x_period && (
        <ReportChartCard title={t('customers.depth.byOwnerPeriod.title')} chart={
          <>
            <Caption>{t('customers.depth.fixedWindow6')}</Caption>
            <WeeklyBarChartCard data={buildOwnerPeriodRows(data.by_owner_x_period)} series={buildOwnerPeriodSeries(data.by_owner_x_period, t)} />
          </>
        } />
      )}

      {/* Prospect → customer conversion per monthly cohort — fixed 12-month window, inert. */}
      {data.phase_cohorts && (
        <ReportChartCard span={2} title={t('customers.depth.cohorts.title')} chart={
          <>
            <Caption>{t('customers.depth.fixedWindow12')}</Caption>
            <WeeklyBarChartCard
              data={data.phase_cohorts.map(c => ({ name: formatMonth(c.cohort), value: c.prospects, prospects: c.prospects, converted: c.converted, rate: c.rate == null ? null : Math.round(c.rate * 100) }))}
              series={[
                { key: 'prospects', label: t('customers.depth.cohorts.prospects'), color: CHART_SERIES_COLORS[0] },
                // Converted bars read a house series colour rather than the raw
                // success token: the huisstijl ceiling counts every disable as
                // drift (CLAUDE.md §4 r7), so a semantic-but-flagged fill is not
                // a legitimate trade here — the series LABEL still carries the
                // meaning ("Converted"), colour stays decorative/categorical.
                { key: 'converted', label: t('customers.depth.cohorts.converted'), color: CHART_SERIES_COLORS[1] },
                // The conversion RATE is a percentage: its own right axis, never the count scale.
                { key: 'rate', label: t('customers.depth.cohorts.rate'), color: 'var(--text)', line: true, axis: 'right' },
              ]}
              rightAxisUnit="%"
            />
          </>
        } />
      )}
    </>
  )
}

// One row per month; one numeric field per owner (key = owner_id ?? 'none').
function buildOwnerPeriodRows(rows: NonNullable<CustomersReportData['by_owner_x_period']>): ChartDatum[] {
  // Union of every owner's months (not just the first owner's), so a month
  // missing for one owner but present for another never silently disappears.
  const months = [...new Set(rows.flatMap(owner => owner.months.map(m => m.month)))].sort()
  return months.map(month => {
    const row: ChartDatum = { name: formatMonth(month), value: 0 }
    rows.forEach(owner => {
      const key = owner.owner_id ?? 'none'
      const found = owner.months.find(m => m.month === month)
      ;(row as Record<string, unknown>)[key] = found?.count ?? 0
    })
    return row
  })
}

// One series per owner, in the row's own colour or the house fallback.
function buildOwnerPeriodSeries(rows: NonNullable<CustomersReportData['by_owner_x_period']>, t: (key: string) => string) {
  return rows.map((owner, i) => ({
    key: owner.owner_id ?? 'none',
    label: owner.owner_id == null ? t('customers.depth.unassigned') : owner.name,
    color: CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length],
  }))
}
