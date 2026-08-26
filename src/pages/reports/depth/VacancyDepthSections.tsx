/**
 * VacancyDepthSections — the DASH-FEEDS-V3 depth blocks for the vacancies
 * report (ttf_decomposition, fill_rate_timeseries, fill_rate_by_branch, aging).
 * All four fields are OPTIONAL on VacanciesReportData (the compare endpoint's
 * diffed envelope omits them), so each section self-hides when its own field
 * is absent — never a fabricated zero-state (SCHERMWAARHEID). Renders a React
 * fragment of ReportChartCard cells; the page's ReportGrid lays them out.
 */
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import KpiCard from '@/components/ui/KpiCard'
import { Caption, Mono } from '@/components/ui/typography'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import LineChartCard from '@/components/charts/LineChartCard'
import ReportChartCard from '../ReportChartCard'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat } from '@/lib/formatters'
import type { VacanciesReportData } from '@/types/analytics'

// One aging row shape, matching the server field exactly (§ measured facts).
type AgingRow = NonNullable<VacanciesReportData['aging']>[number]
// One fill-rate-by-branch row shape, matching the server field exactly.
type BranchRow = NonNullable<VacanciesReportData['fill_rate_by_branch']>[number]

// The vacancies report's four depth blocks (see file docblock above); each
// section self-hides when its own optional field is absent, never a fake zero-state.
export default function VacancyDepthSections({ data, onAgingRow }: {
  data: VacanciesReportData
  // Optional: gateDrillClick (§ drill gate) yields undefined when the drill
  // endpoint is unavailable — DataTable then renders the row inert (no
  // pointer cursor, no role=button), never a fake affordance.
  onAgingRow?: (row: AgingRow) => void
}) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatPercent, formatNumber } = useNumberFormat()

  // Section 1: time-to-fill decomposition, three median-day KPI tiles. Informational only.
  const ttf = data.ttf_decomposition
  const ttfValue = (n: number | null) => n == null ? '—' : t('vacancies.daysValue', { days: n })

  // Section 2: fill-rate timeseries — a fixed 14-day window (ignores the report's period).
  const series = data.fill_rate_timeseries
  const seriesPoints = (series ?? [])
    .filter(p => p.rate != null)
    .map(p => ({ name: formatDate(p.date, { day: '2-digit', month: '2-digit' }), value: Math.round(p.rate as number) }))

  // Section 3: fill rate by branch — the house default 3-month window (also ignores the panel filters).
  const branchRows = data.fill_rate_by_branch
  const branchColumns: Column<BranchRow>[] = [
    { key: 'branch', header: t('vacancies.depth.fillRateBranch.cols.branch'),
      render: r => r.branch_id == null ? t('vacancies.depth.noBranch') : r.branch },
    { key: 'total', header: t('vacancies.depth.fillRateBranch.cols.total'), align: 'right', nowrap: true,
      render: r => <Mono>{formatNumber(r.total)}</Mono> },
    { key: 'filled', header: t('vacancies.depth.fillRateBranch.cols.filled'), align: 'right', nowrap: true,
      render: r => <Mono>{formatNumber(r.filled)}</Mono> },
    { key: 'rate', header: t('vacancies.depth.fillRateBranch.cols.rate'), align: 'right', nowrap: true,
      render: r => <Mono>{r.rate == null ? '—' : formatPercent(r.rate)}</Mono> },
  ]

  // Section 4: aging — top-20 longest-open vacancies, from the same window +
  // panel-filtered base every other axis on this report uses (vacanciesQuery($p)).
  const agingRows = data.aging
  const agingColumns: Column<AgingRow>[] = [
    { key: 'vacancy', header: t('vacancies.depth.aging.cols.vacancy'), render: r => r.title },
    // The server's unresolved-owner literal renders as-is (no id/sentinel to key on here).
    { key: 'recruiter', header: t('vacancies.depth.aging.cols.recruiter'), render: r => r.recruiter ?? '—' },
    { key: 'daysOpen', header: t('vacancies.depth.aging.cols.daysOpen'), align: 'right', nowrap: true,
      render: r => <Mono>{formatNumber(r.days_open)}</Mono> },
    { key: 'inProcess', header: t('vacancies.depth.aging.cols.inProcess'), align: 'right', nowrap: true,
      render: r => <Mono>{formatNumber(r.candidates_in_process)}</Mono> },
    // applications: the full population (CMBE 0ecd0bf5), what the row click drills into.
    { key: 'applications', header: t('vacancies.depth.aging.cols.applications'), align: 'right', nowrap: true,
      render: r => <Mono>{formatNumber(r.applications)}</Mono> },
  ]

  return (
    <>
      {/* ttf_decomposition: three median-day KPI tiles, informational (no drill). */}
      {ttf && (
        <ReportChartCard span={2} title={t('vacancies.depth.ttf.title')} chart={
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <KpiCard icon={Clock} label={t('vacancies.depth.ttf.publishedToFirst')} value={ttfValue(ttf.published_to_first_application)} />
            <KpiCard icon={Clock} label={t('vacancies.depth.ttf.firstToProposal')} value={ttfValue(ttf.first_application_to_proposal)} />
            <KpiCard icon={Clock} label={t('vacancies.depth.ttf.proposalToMatch')} value={ttfValue(ttf.proposal_to_match)} />
          </div>
        } />
      )}

      {/* fill_rate_timeseries: fixed 14-day window, informational (no drill). */}
      {series && (
        <ReportChartCard title={t('vacancies.depth.fillRateSeries.title')} chart={
          <>
            <Caption as="div">{t('vacancies.depth.fixedWindow')}</Caption>
            <LineChartCard data={seriesPoints} formatValue={formatPercent} />
          </>
        } />
      )}

      {/* fill_rate_by_branch: house 3-month default window, informational (no drill). */}
      {branchRows && (
        <ReportChartCard title={t('vacancies.depth.fillRateBranch.title')} chart={
          <>
            <Caption as="div">{t('vacancies.depth.fixedWindow')}</Caption>
            <DataTable columns={branchColumns} rows={branchRows} getRowId={r => r.branch_id ?? 'none'} />
          </>
        } />
      )}

      {/* aging: top-20 longest-open vacancies; row click drills into the vacancy's applications. */}
      {agingRows && (
        <ReportChartCard span={2} title={t('vacancies.depth.aging.title')} chart={
          <DataTable columns={agingColumns} rows={agingRows} getRowId={r => r.id} onRowClick={onAgingRow} />
        } />
      )}
    </>
  )
}
