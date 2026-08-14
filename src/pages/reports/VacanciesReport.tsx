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
import type { KpiSpec } from '@/components/insights/InsightsRow'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import SoftChip from '@/components/ui/SoftChip'
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

  const kpiByKey: Record<string, KpiSpec> = {
    total: { key: 'total',  label: t('vacancies.summary.total'),  value: s?.total ?? 0,
      active: drill != null && drill.rowsParams?.status == null,
      onClick: gateDrillClick('vacancies', () => openVacancies(t('vacancies.summary.total'), s?.total ?? 0)) },
    open: { key: 'open',   label: t('vacancies.summary.open'),   value: s?.open ?? 0,
      active: drill?.rowsParams?.status === 'open',
      onClick: gateDrillClick('vacancies', () => openVacancies(t('vacancies.summary.open'), s?.open ?? 0, 'open')) },
    filled: { key: 'filled', label: t('vacancies.summary.filled'), value: s?.filled ?? 0,
      active: drill?.rowsParams?.status === 'filled',
      onClick: gateDrillClick('vacancies', () => openVacancies(t('vacancies.summary.filled'), s?.filled ?? 0, 'filled')) },
    fillRate: { key: 'fillRate', label: t('vacancies.summary.fillRate'),
      value: s ? formatRatio(s.fill_rate) : '—' },
    ttf: { key: 'ttf', label: t('vacancies.summary.avgTimeToFill'),
      value: s?.avg_time_to_fill_days != null ? t('vacancies.daysValue', { days: Math.round(s.avg_time_to_fill_days) }) : '—' },
    // PDF-VACATURES point 31: "vacature staat online maar geen kandidaten na X
    // dagen" — the real, tenant-threshold-driven backend count (VacanciesReport
    // ::applySignal SIGNAL_STALE_ONLINE), the same predicate the row-level
    // vacancyAdvice.ts rule and the list's stale_online filter already use. No
    // drill route exists yet for this signal (the drill endpoint's eight-way XOR
    // does not include `signal` — see the handoff note below), so this card is a
    // plain, non-fabricated stat, not clickable.
    staleOnline: { key: 'staleOnline', label: t('vacancies.summary.staleOnline'), value: s?.stale_online ?? 0 },
    // Plain stat — no single XOR value represents "distinct customers", so not clickable.
    customersCount: { key: 'customersCount', label: t('vacancies.summary.customersCount'), value: customersCount },
    topIndustry: { key: 'topIndustry', label: t('vacancies.summary.topIndustry'),
      value: topIndustry ? `${topIndustry.label} · ${topIndustry.count}` : '—',
      onClick: topIndustry ? gateDrillClick('vacancies', () => openSegment(topIndustry, { industry: topIndustry.value })) : undefined },
    topOwner: { key: 'topOwner', label: t('vacancies.summary.topOwner'),
      value: topOwner ? `${topOwner.name} · ${topOwner.count}` : '—',
      onClick: topOwner ? gateDrillClick('vacancies', () => openSegment({ label: topOwner.name, count: topOwner.count }, { owner: topOwner.owner_id })) : undefined },
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
          {v.code && <span style={{ marginLeft: 6, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{v.code}</span>}
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
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('vacancies.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
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
        <>
          {/* Timeseries + the six segment axes (portie pattern) */}
          <div style={{ ...card, overflow: 'hidden', marginBottom: 16 }}>
            <VacancyReportAxes data={data} onSegment={openSegment} onBucket={openBucket} />
          </div>

          {/* Per-vacancy table (unchanged C-34 behaviour) — row click drills into
              that vacancy's own applications. */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={v => v.key}
              onRowClick={gateDrillClick('vacancies', openVacancyRow)}
              emptyText={t('vacancies.empty')}
            />
          </div>

          {/* PDF notification signal: vacancies with zero applications this window.
              Real rows, not a fabricated count — see zeroApplicantRows above. Only
              rendered when it has something to show (an all-zero-row empty state
              here would just duplicate the table's own empty text above it). */}
          {zeroApplicantRows.length > 0 && (
            <div style={{ ...card, overflow: 'hidden', marginTop: 16 }}>
              <div style={{ padding: '16px 20px 0' }}>
                <h3 style={reportSectionHeadStyle}>
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
          )}
        </>
      )}

      {/* Dynamic drill-down: explains the clicked number + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
