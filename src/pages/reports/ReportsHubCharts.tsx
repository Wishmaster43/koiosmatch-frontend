/**
 * ReportsHubCharts — the hub's chart grid (Danny 24-08: the bare #reports
 * overview must show dashboard-style chart blocks with drill-through, not just
 * KPI numbers). Six blocks built from data ReportsDashboard already fetched
 * for its KPI band (no second fetch of the same endpoint — the hook results
 * are passed down as props). Mirrors CandidatesReport.tsx's chart composition
 * (ReportGrid + ReportChartCard + the house chart atoms); each block carries
 * its own "open report" affordance (a ghost Button in the card title) since
 * this page has no drill drawer of its own — clicking through goes straight to
 * the sub-report that owns the data.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import ReportStateBlock from './ReportStateBlock'
import ReportsHubAttention from './ReportsHubAttention'
import { HubBlockBody, HubBlockTitle } from './hubLayout'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import { useNavigation } from '@/context/NavigationContext'
import { useDateFormat } from '@/lib/datetime'
import type {
  ApplicationsReportData, VacanciesReportData, MatchesReportData, TasksReportData, CandidatesReportData,
} from '@/types/analytics'

// One hook's normalised three states — the fourth (success) is `data` present.
type HookState<T> = { data: T | null; loading: boolean; error: boolean }

// A chart card's title row: the translated heading plus a ghost "open report"
// button that navigates straight to the sub-report this block's data came from.
function ChartTitle({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  const { t } = useTranslation('analytics')
  return (
    <HubBlockTitle action={<Button variant="ghost" size="sm" onClick={onOpen}>{t('hub.openReport')}</Button>}>
      {children}
    </HubBlockTitle>
  )
}

// One block's four states inside the shared fixed-height hub body; states
// centre, a chart sits at the top — every block ends up exactly the same size.
function ChartBlock({ title, onOpen, loading, error, empty, span, chart }: {
  title: ReactNode; onOpen: () => void; loading: boolean; error: boolean; empty: boolean; span?: 1 | 2; chart: ReactNode
}) {
  const { t } = useTranslation('common')
  const inState = loading || error || empty
  return (
    <ReportChartCard span={span} title={<ChartTitle onOpen={onOpen}>{title}</ChartTitle>} chart={
      <HubBlockBody centered={inState}>
        {inState ? (
          <ReportStateBlock loading={loading} error={error} empty={empty}
            loadingLabel={t('loading')} errorLabel={t('error.loadFailed')} emptyLabel={t('empty')} />
        ) : chart}
      </HubBlockBody>
    } />
  )
}

// Six dashboard-style chart blocks, each backed by an already-fetched report
// hook (no second fetch) with its own drill-through to the owning sub-report.
export default function ReportsHubCharts({ applications, vacancies, matches, tasks, candidates }: {
  applications: HookState<ApplicationsReportData>
  vacancies: HookState<VacanciesReportData>
  matches: HookState<MatchesReportData>
  tasks: HookState<TasksReportData>
  candidates: HookState<CandidatesReportData>
}) {
  const { t } = useTranslation('analytics')
  const { navigate } = useNavigation()
  const { formatDate } = useDateFormat()
  const open = (id: string) => () => navigate(`reports.${id}`)

  // Applications funnel bucket counts → four named bars (§ EENHEID-LES: plain counts, no percent mode).
  const bucket = applications.data?.by_bucket
  const bucketData: ChartDatum[] = bucket ? [
    { name: t('hub.charts.bucket.active'),   value: bucket.active },
    { name: t('hub.charts.bucket.matched'),  value: bucket.matched },
    { name: t('hub.charts.bucket.placed'),   value: bucket.placed },
    { name: t('hub.charts.bucket.rejected'), value: bucket.rejected },
  ] : []

  // Fill-rate timeseries: `rate` is a server PERCENT VALUE (0..100), not a
  // count — percentValues, never showPercent (§14 EENHEID-LES).
  const fillRateData: ChartDatum[] = (vacancies.data?.fill_rate_timeseries ?? [])
    .filter(pt => pt.rate != null)
    .map(pt => ({ name: formatDate(pt.date), value: pt.rate as number }))

  // Matches under contract: sent/active/ended — three named bars.
  const underContract = matches.data?.under_contract
  const underContractData: ChartDatum[] = underContract ? [
    { name: t('hub.charts.underContract.sent'),   value: underContract.sent },
    { name: t('hub.charts.underContract.active'), value: underContract.active },
    { name: t('hub.charts.underContract.ended'),  value: underContract.ended },
  ] : []

  // Tasks by status — the report's own status segments (tenant lookup colours).
  const taskStatusData: ChartDatum[] = (tasks.data?.by_status ?? []).map(s => ({ name: s.label, value: s.count, key: s.value }))
  const taskStatusColors = (tasks.data?.by_status ?? []).map((s, i) => s.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length])

  // Candidates by source — the report's own source segments.
  const sourceData: ChartDatum[] = (candidates.data?.by_source ?? []).map(s => ({ name: s.label, value: s.count, key: s.value }))
  const sourceColors = (candidates.data?.by_source ?? []).map((s, i) => s.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length])

  return (
    <ReportGrid>
      {/* The attention list sits beside the trend, sharing the chart cards' chrome. */}
      <ReportsHubAttention />

      {/* Applications inflow over time — mirrors the sub-report's own line. */}
      <ChartBlock title={t('hub.charts.applicationsTrend')} onOpen={open('applications')}
        loading={applications.loading} error={applications.error} empty={!applications.loading && !applications.error && (applications.data?.timeseries?.series?.length ?? 0) === 0}
        chart={<ReportTimeseriesChart series={applications.data?.timeseries?.series ?? []} />} />

      <ChartBlock title={t('hub.charts.applicationsFunnel')} onOpen={open('applications')}
        loading={applications.loading} error={applications.error} empty={!applications.loading && !applications.error && bucketData.every(d => d.value === 0)}
        chart={<BarChartCard data={bucketData} />} />

      <ChartBlock title={t('hub.charts.candidatesBySource')} onOpen={open('candidates')}
        loading={candidates.loading} error={candidates.error} empty={!candidates.loading && !candidates.error && sourceData.length === 0}
        chart={<PieChartCard data={sourceData} colors={sourceColors} />} />

      <ChartBlock title={t('hub.charts.vacanciesFillRate')} onOpen={open('vacancies')}
        loading={vacancies.loading} error={vacancies.error} empty={!vacancies.loading && !vacancies.error && fillRateData.length === 0}
        chart={<BarChartCard data={fillRateData} percentValues />} />

      <ChartBlock title={t('hub.charts.matchesUnderContract')} onOpen={open('matches')}
        loading={matches.loading} error={matches.error} empty={!matches.loading && !matches.error && underContractData.every(d => d.value === 0)}
        chart={<BarChartCard data={underContractData} />} />

      <ChartBlock title={t('hub.charts.tasksByStatus')} onOpen={open('tasks')}
        loading={tasks.loading} error={tasks.error} empty={!tasks.loading && !tasks.error && taskStatusData.length === 0}
        chart={<PieChartCard data={taskStatusData} colors={taskStatusColors} />} />
    </ReportGrid>
  )
}
