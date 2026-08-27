/**
 * VacanciesReport — vacancies report (GET /reports/vacancies, RAPPORTEN-SUITE-1
 * "portie 4"). KPI-VAC-1 (CMBE 28-08): the strip now reads the server's own
 * nine-card kpis[] suite verbatim (total/open/filled/fill_rate/stale_online/
 * long_concept/no_matches/closing_soon/customers_count), mirroring KPI-MATCHES-1/
 * KPI-OPP-1. Below the strip: the per-vacancy table keeps working unchanged, now
 * joined by the portie-pattern blocks — the wave-2 chart mix (status donut in
 * lookup colours, ranking axes as bar charts, timeseries line span-2; see
 * VacancyReportAxes). Drill XOR params follow the eight-way vacancies contract:
 * status|customer|function|industry|owner|branch|date|vacancy (plus `kpi` for the
 * strip's own kpis/drill route). Data lives in the hook; the table uses the
 * shared DataTable (§4 blueprint-conformance).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { interactive } from '@/lib/a11y'
import ReportKpiBand from './ReportKpiBand'
import ReportStateBlock from './ReportStateBlock'
import { reportCardStyle as card, reportSectionHeadStyle } from './ReportSectionCard'
import ReportGrid, { ReportGridItem } from './ReportGrid'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import SoftChip from '@/components/ui/SoftChip'
import { BodyText, Caption, Mono } from '@/components/ui/typography'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import VacancyReportAxes from './VacancyReportAxes'
import VacancyDepthSections from './depth/VacancyDepthSections'
import { useVacanciesReport } from './useVacanciesReport'
import { gateDrillClick } from './reportDrillGate'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, VacancyReportRow, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import { formatKpiUnitValue } from './kpiUnitFormat'
import type { KpiUnit } from './kpiUnitFormat'

// Number cell: emphasised when > 0, muted when zero (mirrors the SM entity tables).
const numCell = (n: number) => (
  <span style={{ fontWeight: n > 0 ? 600 : 400, color: n > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{n}</span>
)

// Vacancies report: server-suite KPI strip (KPI-VAC-1) plus charts, scoped by period/filters/compare.
export default function VacanciesReport({ period, filters = EMPTY_REPORT_FILTERS, compare = COMPARE_OFF }: { period: ReportPeriod; filters?: ReportFilterState; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useVacanciesReport(period, filters)
  const rows    = data?.vacancies ?? []
  const hasData = !loading && !error && (data?.total ?? 0) > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('vacancies')
  const compareBaseParams = { ...buildReportQueryParams(period, 'vacancies', filters) }
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compare, compareBaseParams)
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // One drawer for every drill source: KPI tiles, table rows, axis bars, buckets —
  // ALWAYS layered on top of the report's own active panel filters (`baseParams`),
  // never just `period`, so the lade counts the exact same set the bar was drawn from.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const baseParams = buildReportQueryParams(period, 'vacancies', filters)

  // Legacy per-vacancy drill (row click): the APPLICATION rows behind one vacancy.
  const openVacancyRow = (v: VacancyReportRow) => setDrill({
    title: v.label, value: v.applications, subtitle: v.customer?.name ?? t(`period.${period}`),
    breakdown: [
      { label: t('vacancies.cols.applications'), value: v.applications },
      { label: t('vacancies.cols.matched'),      value: v.matched },
    ],
    rowsEndpoint: '/reports/vacancies/drill', rowsParams: { ...baseParams, vacancy: v.key },
    adviceEndpoint: '/reports/vacancies/advice', adviceParams: { ...baseParams, vacancy: v.key },
  })
  // Portie-4 segment drill: exactly one XOR param per open drill (vacancy rows
  // behind it) — entityPage deep-links the drawer's rows to the vacancy drilldown.
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: windowSub(),
    entityPage: 'vacancies',
    rowsEndpoint: '/reports/vacancies/drill', rowsParams: { ...baseParams, ...xorParam },
    adviceEndpoint: '/reports/vacancies/advice', adviceParams: { ...baseParams, ...xorParam },
  })
  // DASH-FEEDS-V3 depth: the aging table's row click, same endpoints/window as
  // openVacancyRow. The headline value is now row.applications (CMBE 0ecd0bf5) —
  // the drawer's rows are ALL applications of the vacancy (rowsEndpoint has no
  // stage filter), so the headline number must match that population
  // (kaartdrill-invariant). candidates_in_process (non-terminal only) moves to
  // the breakdown line instead of driving the headline.
  const onAgingRow = (row: { id: string; title: string; days_open: number; candidates_in_process: number; applications: number }) => setDrill({
    title: row.title, value: row.applications,
    subtitle: `${t('vacancies.cols.applications')} · ${windowSub()}`,
    breakdown: [
      { label: t('vacancies.depth.aging.cols.inProcess'), value: row.candidates_in_process },
      { label: t('vacancies.depth.aging.cols.daysOpen'), value: row.days_open },
    ],
    rowsEndpoint: '/reports/vacancies/drill', rowsParams: { ...baseParams, vacancy: row.id },
    adviceEndpoint: '/reports/vacancies/advice', adviceParams: { ...baseParams, vacancy: row.id },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/vacancies/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/vacancies/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })

  // PDF signal "vacancies without any applications": `rows` is the report's own
  // complete (non-paginated, non-top-N) per-vacancy list for this window/filter
  // set — so counting `applications === 0` here is an honest, exact aggregate, not
  // a derived guess. This is a DIFFERENT, narrower question than the PDF's "online
  // X days with no candidates" signal (that one needs a per-vacancy days-open field
  // and a configurable threshold the backend does not expose yet — not built here,
  // see the backend ask in the handoff notes).
  const zeroApplicantRows = rows.filter(v => v.applications === 0)
  // REPORTS-DRILL-2 (verified live): the section header's own click into the
  // backend's real `zero_applications=1` drill — gated the same way every other
  // segment click is, never a bespoke fetch.
  const zeroApplicationsDrillHandler = gateDrillClick('vacancies', () => openSegment(
    { label: t('vacancies.noApplicants.title', { count: zeroApplicantRows.length }), count: zeroApplicantRows.length },
    { zero_applications: 1 },
  ))

  // KPI-VAC-1 (CMBE 28-08, BuildsVacancyKpis): the strip reads the server's
  // own nine-card kpis[] suite verbatim — mirrors KPI-MATCHES-1/KPI-OPP-1's
  // idiom (kpiByServerKey Map, one predicate shared by value and drill). A key
  // the server omitted (or a pre-suite cached envelope) renders the house dash
  // with no drill — never a value from another population. The retired
  // topIndustry/topOwner/topFunction/topBranch cards keep their DATA surface:
  // industry/owner/function/branch each still render as a bar/donut axis below
  // (VacancyReportAxes). adviceStale shared stale_online's exact predicate
  // (still a card here as staleOnline), so no rows are lost. avg_time_to_fill_days
  // left the strip; VacancyDepthSections still surfaces time-to-fill via its
  // median phase decomposition (ttf_decomposition) — a related but not
  // identical aggregate, flagged for Danny below.
  const kpiByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.count]))
  const openKpiDrill = (kpi: string, label: string, value: string | number, subtitle?: string) =>
    gateDrillClick('vacancies', () => setDrill({
      title: label, value, subtitle: subtitle ?? windowSub(), entityPage: 'vacancies',
      rowsEndpoint: '/reports/vacancies/kpis/drill', rowsParams: { ...baseParams, kpi },
    }))
  // Semantic colour only where the number is a SIGNAL and non-zero (§4: colour
  // carries meaning; a calm zero stays uncoloured).
  const KPI_COLOR: Partial<Record<string, string>> = {
    filled: 'var(--color-success)', stale_online: 'var(--color-warning)',
    no_matches: 'var(--color-danger)', closing_soon: 'var(--color-warning)',
  }
  const SUITE_LABEL_KEY: Record<string, string> = {
    total: 'vacancies.kpi.total', open: 'vacancies.kpi.open', filled: 'vacancies.kpi.filled',
    fill_rate: 'vacancies.kpi.fillRate', stale_online: 'vacancies.kpi.staleOnline',
    long_concept: 'vacancies.kpi.longConcept', no_matches: 'vacancies.kpi.noMatches',
    closing_soon: 'vacancies.kpi.closingSoon', customers_count: 'vacancies.kpi.customersCount',
  }
  // UNIT-CANON (FRONTEND-CONTRACT §13, REPORT-KPI-STRIP-1): the SERVER's unit
  // field on each kpis[] entry decides the formatting; the local map is only the
  // tolerant fallback for a cached pre-unit envelope (§10) — never the source.
  const KPI_UNIT_FALLBACK: Partial<Record<string, KpiUnit>> = { fill_rate: 'ratio' }
  const unitByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.unit ?? KPI_UNIT_FALLBACK[k.key]]))
  const openKpiParams = drill?.rowsParams as Record<string, unknown> | undefined
  const kpiByKey: Record<string, KpiSpec> = Object.fromEntries(
    Object.entries(SUITE_LABEL_KEY).map(([key, labelKey]) => {
      const label = t(labelKey)
      const raw = kpiByServerKey.get(key)
      const has = raw != null
      const unit = unitByServerKey.get(key)
      const value = !has ? '—' : unit ? formatKpiUnitValue(raw, unit) : raw
      // PARITY EXCEPTION (documented BE-side, KPI-VAC-1): customers_count counts
      // DISTINCT customers while its drill lists those customers' VACANCIES (rows
      // ≥ card value) — an explicit subtitle names the divergence instead of the
      // default window text.
      const subtitle = key === 'customers_count' ? t('vacancies.kpi.customersCountDrillSub') : undefined
      return [key, {
        key, label, value,
        color: has && raw !== 0 ? KPI_COLOR[key] : undefined,
        active: openKpiParams?.kpi === key,
        // KPI-DREMPELS-FE-1: threshold cards keep their tenant-threshold caption.
        sub: key === 'total' && totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" />
          : key === 'stale_online' && data?.summary?.advice_stale_days != null ? t('thresholdDays', { n: data.summary.advice_stale_days })
          : key === 'closing_soon' && data?.summary?.closing_soon_days != null ? t('thresholdDays', { n: data.summary.closing_soon_days })
          : undefined,
        onClick: has ? openKpiDrill(key, label, value, subtitle) : undefined,
      } satisfies KpiSpec]
    }))
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('vacancies').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('vacancies')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('vacancies'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  // Columns — soft chips for status/filled (§4), numeric cols right-aligned + sortable.
  const columns: Column<VacancyReportRow>[] = [
    {
      key: 'label', header: t('vacancies.cols.vacancy'), sortable: true, sortValue: v => v.label ?? '',
      render: v => (
        <>
          {v.label}
          {v.code && <Caption style={{ marginLeft: 6 }}><Mono>{v.code}</Mono></Caption>}
        </>
      ),
    },
    {
      key: 'customer', header: t('vacancies.cols.customer'), sortable: true, sortValue: v => v.customer?.name ?? '',
      cellStyle: { color: 'var(--text-muted)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' },
      render: v => v.customer?.name ?? '—',
    },
    {
      key: 'status', header: t('vacancies.cols.status'), sortable: true, sortValue: v => v.status?.label ?? '',
      render: v => v.status?.label ? <SoftChip label={v.status.label} round /> : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    { key: 'applications', header: t('vacancies.cols.applications'), align: 'right', sortable: true, sortValue: v => v.applications, render: v => numCell(v.applications) },
    { key: 'matched',      header: t('vacancies.cols.matched'),      align: 'right', sortable: true, sortValue: v => v.matched,      render: v => numCell(v.matched) },
    {
      key: 'filled', header: t('vacancies.cols.filled'), sortable: true, sortValue: v => (v.filled ? 1 : 0),
      render: v => <SoftChip label={v.filled ? t('vacancies.filledYes') : t('vacancies.filledNo')}
        color={v.filled ? 'var(--color-success)' : 'var(--text-muted)'} round />,
    },
    {
      key: 'time_to_fill_days', header: t('vacancies.cols.timeToFill'), align: 'right', sortable: true,
      sortValue: v => v.time_to_fill_days ?? -1,
      render: v => v.time_to_fill_days != null ? t('vacancies.daysValue', { days: v.time_to_fill_days }) : '—',
    },
  ]

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order: KPIs first) */}
      {hasData && rows.length > 0 && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('vacancies.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data?.from && data?.to && (
        <BodyText style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('vacancies.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </BodyText>
      )}

      {/* Four UI states, handled once via the shared block (§3) */}
      {(loading || error || (data?.total ?? 0) === 0) && (
        <div style={card}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && (data?.total ?? 0) === 0}
            loadingLabel={t('vacancies.loading')} errorLabel={t('vacancies.error')} emptyLabel={t('vacancies.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Timeseries + the six segment axes (portie pattern) */}
          <VacancyReportAxes data={data} onSegment={openSegment} onBucket={openBucket} />

          {/* DASH-FEEDS-V3 depth blocks: ttf/fill-rate-series/fill-rate-branch/aging. */}
          <VacancyDepthSections data={data} onAgingRow={gateDrillClick('vacancies', onAgingRow)} />

          {/* Per-vacancy table (unchanged C-34 behaviour) — row click drills into
              that vacancy's own applications. Wide table, full row. */}
          <ReportGridItem span={2}>
            <div style={{ ...card, overflow: 'hidden' }}>
              <DataTable
                columns={columns}
                rows={rows}
                getRowId={v => v.key}
                onRowClick={gateDrillClick('vacancies', openVacancyRow)}
                emptyText={t('vacancies.empty')}
              />
            </div>
          </ReportGridItem>

          {/* PDF notification signal: vacancies with zero applications this window.
              The table rows are real, not fabricated — see zeroApplicantRows above
              (the exact array driving both this header's count AND the rows right
              below it, so they can never disagree). REPORTS-DRILL-2 (verified live):
              the header title ALSO opens the backend's own `zero_applications=1`
              drill (published + whereDoesntHave('applications'), a narrower/different
              predicate than this window's client-side "applications === 0 regardless
              of published" list) so the tenant-wide, unwindowed signal stays reachable
              alongside this window's own honest table. Only rendered when the client
              list has something to show (an all-zero-row empty state here would just
              duplicate the table's own empty text above it). */}
          {zeroApplicantRows.length > 0 && (
            <ReportGridItem span={2}>
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px 0' }}>
                  {/* Real keyboard-operable trigger: interactive() adds role/tabIndex/Enter-Space, the global :focus-visible ring makes it visible (§6) */}
                  <h3 style={{ ...reportSectionHeadStyle, ...(zeroApplicationsDrillHandler ? { cursor: 'pointer' } : {}) }}
                    {...interactive(zeroApplicationsDrillHandler)}>
                    {t('vacancies.noApplicants.title', { count: zeroApplicantRows.length })}
                  </h3>
                  <Caption style={{ display: 'block', margin: '4px 0 12px' }}>
                    {t('vacancies.noApplicants.subtitle')}
                  </Caption>
                </div>
                <DataTable
                  columns={columns.filter(c => c.key !== 'applications' && c.key !== 'matched' && c.key !== 'filled')}
                  rows={zeroApplicantRows}
                  getRowId={v => v.key}
                  onRowClick={gateDrillClick('vacancies', openVacancyRow)}
                  emptyText={t('vacancies.noApplicants.empty')}
                />
              </div>
            </ReportGridItem>
          )}
        </ReportGrid>
      )}

      {/* Dynamic drill-down: explains the clicked number + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
