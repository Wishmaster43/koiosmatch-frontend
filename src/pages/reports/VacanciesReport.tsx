/**
 * VacanciesReport — vacancies report (GET /reports/vacancies, RAPPORTEN-SUITE-1
 * "portie 4"). ADDITIVE on the old C-34 screen: the summary tile row (total ·
 * open · filled · fill-rate · avg time-to-fill) and the per-vacancy table keep
 * working unchanged, now joined by the portie-pattern blocks — timeseries + six
 * segment axes through the shared SegmentBars (mirrors CustomersReport /
 * ApplicationsReport). Drill XOR params follow the eight-way vacancies contract:
 * status|customer|function|industry|owner|branch|date|vacancy. Data lives in the
 * hook; the table uses the shared DataTable (§4 blueprint-conformance).
 */
import { useState } from 'react'
import { formatRatio } from '@/lib/formatters'
import { useTranslation } from 'react-i18next'
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
import ReportCompareControl from './ReportCompareControl'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'

// Number cell: emphasised when > 0, muted when zero (mirrors the SM entity tables).
const numCell = (n: number) => (
  <span style={{ fontWeight: n > 0 ? 600 : 400, color: n > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{n}</span>
)

export default function VacanciesReport({ period, filters = EMPTY_REPORT_FILTERS }: { period: ReportPeriod; filters?: ReportFilterState }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useVacanciesReport(period, filters)
  const rows    = data?.vacancies ?? []
  const s       = data?.summary
  const hasData = !loading && !error && (data?.total ?? 0) > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('vacancies')
  const [compareMode, setCompareMode] = useState<ReportCompareMode>(COMPARE_OFF)
  const compareBaseParams = { ...buildReportQueryParams(period, 'vacancies', filters) }
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compareMode, compareBaseParams)
  const totalCompare = compareMode.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // One drawer for every drill source: KPI tiles, table rows, axis bars, buckets —
  // ALWAYS layered on top of the report's own active panel filters (`baseParams`),
  // never just `period`, so the lade counts the exact same set the bar was drawn from.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const baseParams = buildReportQueryParams(period, 'vacancies', filters)

  // Summary-KPI drill (unchanged C-34 behaviour): explains the open/filled split.
  const openVacancies = (title: string, value: number | string, status?: string) => setDrill({
    title, value, subtitle: t(`period.${period}`),
    breakdown: [
      { label: t('vacancies.summary.open'),   value: s?.open ?? 0 },
      { label: t('vacancies.summary.filled'), value: s?.filled ?? 0 },
    ],
    rowsEndpoint: '/reports/vacancies/drill', rowsParams: { ...baseParams, status },
    adviceEndpoint: '/reports/vacancies/advice', adviceParams: { ...baseParams, status },
  })
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
  // Portie-4 segment drill: exactly one XOR param per open drill (vacancy rows behind it).
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: windowSub(),
    rowsEndpoint: '/reports/vacancies/drill', rowsParams: { ...baseParams, ...xorParam },
    adviceEndpoint: '/reports/vacancies/advice', adviceParams: { ...baseParams, ...xorParam },
  })
  // KPIS-DRILL-1: the five backend-built kpi-drill cards (fillRate/ttf/
  // customersCount/longConcept/noMatches) route through GET
  // /reports/vacancies/kpis/drill with the exact `kpi` enum key (measured in
  // api-generated.ts::getReportsVacanciesKpisDrill) layered on the same window
  // params every other drill uses.
  const openKpiDrill = (label: string, value: number | string, kpi: 'fill_rate' | 'ttf' | 'customers_count' | 'long_concept' | 'no_matches') => setDrill({
    title: label, value, subtitle: windowSub(),
    rowsEndpoint: '/reports/vacancies/kpis/drill', rowsParams: { ...baseParams, kpi },
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

  // Real, non-fabricated segments to source the four extra KPI slots: the axes
  // already sum to `total` (see VacancyReportAxes) — 'none'/'others' sentinels are
  // excluded here because "the biggest real value" should name an actual customer/
  // industry/owner, not a bucket. The top-of-axis pick reuses openSegment (same
  // gateDrillClick + XOR-param pattern the axis bars use).
  const realSeg = <T extends { value: string; count: number }>(segs: T[]) =>
    segs.filter(x => x.value !== 'none' && x.value !== 'others').sort((a, b) => b.count - a.count)[0]
  const topIndustry = realSeg(data?.by_industry ?? [])
  const topOwner = (data?.by_owner ?? []).filter(o => o.owner_id !== 'none').sort((a, b) => b.count - a.count)[0]
  // Spare-card sources (REPORTS-KPI-SPARE-1): topFunction/topBranch mirror
  // topIndustry (same "biggest real segment" rule, same by_* axes the report
  // already renders below).
  const topFunction = realSeg(data?.by_function ?? [])
  const topBranch = realSeg(data?.by_branch ?? [])
  // Distinct real customers among this window's vacancies (from the rows themselves,
  // not the top-10-capped axis, so it is never truncated by the 'others' bucket).
  const customersCount = new Set(rows.map(v => v.customer?.id).filter(Boolean)).size

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

  const kpiByKey: Record<string, KpiSpec> = {
    total: { key: 'total',  label: t('vacancies.summary.total'),  value: s?.total ?? 0,
      active: drill != null && drill.rowsParams?.status == null,
      sub: totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined,
      onClick: gateDrillClick('vacancies', () => openVacancies(t('vacancies.summary.total'), s?.total ?? 0)) },
    open: { key: 'open',   label: t('vacancies.summary.open'),   value: s?.open ?? 0,
      active: drill?.rowsParams?.status === 'open',
      onClick: gateDrillClick('vacancies', () => openVacancies(t('vacancies.summary.open'), s?.open ?? 0, 'open')) },
    filled: { key: 'filled', label: t('vacancies.summary.filled'), value: s?.filled ?? 0,
      active: drill?.rowsParams?.status === 'filled',
      onClick: gateDrillClick('vacancies', () => openVacancies(t('vacancies.summary.filled'), s?.filled ?? 0, 'filled')) },
    fillRate: { key: 'fillRate', label: t('vacancies.summary.fillRate'),
      value: s ? formatRatio(s.fill_rate) : '—',
      active: drill?.rowsParams?.kpi === 'fill_rate',
      onClick: gateDrillClick('vacancies', () => openKpiDrill(t('vacancies.summary.fillRate'), s ? formatRatio(s.fill_rate) : '—', 'fill_rate')) },
    ttf: { key: 'ttf', label: t('vacancies.summary.avgTimeToFill'),
      value: s?.avg_time_to_fill_days != null ? t('vacancies.daysValue', { days: Math.round(s.avg_time_to_fill_days) }) : '—',
      active: drill?.rowsParams?.kpi === 'ttf',
      onClick: gateDrillClick('vacancies', () => openKpiDrill(t('vacancies.summary.avgTimeToFill'), s?.avg_time_to_fill_days != null ? t('vacancies.daysValue', { days: Math.round(s.avg_time_to_fill_days) }) : '—', 'ttf')) },
    // PDF-VACATURES point 31: "vacature staat online maar geen kandidaten na X
    // dagen" — the real, tenant-threshold-driven backend count (VacanciesReport
    // ::applySignal SIGNAL_STALE_ONLINE), the SAME predicate the row-level
    // vacancyAdvice.ts rule, the list's stale_online filter AND (REPORTS-DRILL-2,
    // verified live) the drill's own `stale_online=1` XOR param all share — so
    // this card's count and the drawer's rows can never disagree.
    staleOnline: { key: 'staleOnline', label: t('vacancies.summary.staleOnline'), value: s?.stale_online ?? 0,
      active: drill?.rowsParams?.stale_online === 1,
      onClick: gateDrillClick('vacancies', () => openSegment({ label: t('vacancies.summary.staleOnline'), count: s?.stale_online ?? 0 }, { stale_online: 1 })) },
    // KPIS-DRILL-1: `customers_count` now has its own kpi-drill endpoint, so the
    // card drills too (was: "no single XOR value represents this, not clickable").
    customersCount: { key: 'customersCount', label: t('vacancies.summary.customersCount'), value: customersCount,
      active: drill?.rowsParams?.kpi === 'customers_count',
      onClick: gateDrillClick('vacancies', () => openKpiDrill(t('vacancies.summary.customersCount'), customersCount, 'customers_count')) },
    topIndustry: { key: 'topIndustry', label: t('vacancies.summary.topIndustry'),
      value: topIndustry ? `${topIndustry.label} · ${topIndustry.count}` : '—',
      onClick: topIndustry ? gateDrillClick('vacancies', () => openSegment(topIndustry, { industry: topIndustry.value })) : undefined },
    topOwner: { key: 'topOwner', label: t('vacancies.summary.topOwner'),
      value: topOwner ? `${topOwner.name} · ${topOwner.count}` : '—',
      onClick: topOwner ? gateDrillClick('vacancies', () => openSegment({ label: topOwner.name, count: topOwner.count }, { owner: topOwner.owner_id })) : undefined },
    // Spares (REPORTS-KPI-SPARE-1): real summary fields the report already
    // fetches but never surfaced as a card (SIGNALEN-VAC-1 family) + the two
    // remaining top-segment picks (function/branch axes, same rule as above).
    // KPIS-DRILL-1: `long_concept`/`no_matches` now drill via kpis/drill (was:
    // no `signal` XOR param on the plain drill endpoint, so left display-only).
    longConcept: { key: 'longConcept', label: t('vacancies.summary.longConcept'), value: s?.long_concept ?? 0,
      active: drill?.rowsParams?.kpi === 'long_concept',
      onClick: gateDrillClick('vacancies', () => openKpiDrill(t('vacancies.summary.longConcept'), s?.long_concept ?? 0, 'long_concept')) },
    noMatches: { key: 'noMatches', label: t('vacancies.summary.noMatches'), value: s?.no_matches ?? 0,
      active: drill?.rowsParams?.kpi === 'no_matches',
      onClick: gateDrillClick('vacancies', () => openKpiDrill(t('vacancies.summary.noMatches'), s?.no_matches ?? 0, 'no_matches')) },
    topFunction: { key: 'topFunction', label: t('vacancies.summary.topFunction'),
      value: topFunction ? `${topFunction.label} · ${topFunction.count}` : '—',
      onClick: topFunction ? gateDrillClick('vacancies', () => openSegment(topFunction, { function: topFunction.value })) : undefined },
    topBranch: { key: 'topBranch', label: t('vacancies.summary.topBranch'),
      value: topBranch ? `${topBranch.label} · ${topBranch.count}` : '—',
      onClick: topBranch ? gateDrillClick('vacancies', () => openSegment(topBranch, { branch: topBranch.value })) : undefined },
    // KPI-DREMPELS-FE-1: summary.advice_stale mirrors staleOnline's exact predicate
    // (same underlying set — reuses that card's own stale_online=1 drill rather than
    // inventing a second signal for the same rows) but now carries its own tenant
    // threshold as a caption.
    adviceStale: { key: 'adviceStale', label: t('vacancies.summary.adviceStale'), value: s?.advice_stale ?? 0,
      sub: s?.advice_stale_days != null ? t('thresholdDays', { n: s.advice_stale_days }) : undefined,
      active: drill?.rowsParams?.stale_online === 1,
      onClick: gateDrillClick('vacancies', () => openSegment({ label: t('vacancies.summary.adviceStale'), count: s?.advice_stale ?? 0 }, { stale_online: 1 })) },
    // summary.closing_soon is a real backend count (open vacancy, application_deadline
    // within the threshold). VAC-CLOSING-SOON-DRILL-1 (landed, SETTINGS-TABS-FIX-2):
    // the drill endpoint now accepts `closing_soon` as its own boolean XOR key, exactly
    // like `stale_online` above — so this card drills the same way, never a `signal` param.
    closingSoon: { key: 'closingSoon', label: t('vacancies.summary.closingSoon'), value: s?.closing_soon ?? 0,
      sub: s?.closing_soon_days != null ? t('thresholdDays', { n: s.closing_soon_days }) : undefined,
      active: drill?.rowsParams?.closing_soon === 1,
      onClick: gateDrillClick('vacancies', () => openSegment({ label: t('vacancies.summary.closingSoon'), count: s?.closing_soon ?? 0 }, { closing_soon: 1 })) },
  }
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
      {/* RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly. */}
      {hasData && rows.length > 0 && compareSlug && (
        <div style={{ marginBottom: 10 }}>
          <ReportCompareControl mode={compareMode} onChange={setCompareMode} />
        </div>
      )}

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
                  <h3 style={{ ...reportSectionHeadStyle, ...(zeroApplicationsDrillHandler ? { cursor: 'pointer' } : {}) }}
                    role={zeroApplicationsDrillHandler ? 'button' : undefined}
                    tabIndex={zeroApplicationsDrillHandler ? 0 : undefined}
                    onClick={zeroApplicationsDrillHandler}>
                    {t('vacancies.noApplicants.title', { count: zeroApplicantRows.length })}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px' }}>
                    {t('vacancies.noApplicants.subtitle')}
                  </p>
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
