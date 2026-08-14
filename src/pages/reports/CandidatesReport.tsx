/**
 * CandidatesReport — candidates/leads INFLOW report (GET /reports/candidates,
 * RAPPORTEN-SUITE-1). Danny's morning first-look: a created_at-windowed view of who
 * came in, broken down over the five axes (status · phase · source · owner · branch)
 * as calm hand-rolled bars (no Recharts, §3B) plus a week/day timeseries. The window
 * is rendered PROMINENTLY (from/to from the envelope) — this report is windowed on
 * created_at while the candidates LIST is not, so an invisible window reads as a bug
 * report ("counts don't match the list") instead of the deliberate report/list split.
 *
 * RAPPORTEN-CONSOLIDATIE-1 (2026-08-14): this page is now "Instroom" and carries a
 * Kandidaten/Leads switch (ReportSwitchBar, mirrors the Shiftmanager dashboard's
 * "In uren / In diensten" toggle) — the sidebar's old standalone 'leads' page merged
 * in here. Leads is REALLY the same `/reports/candidates` call with one extra
 * SERVER-side `phase` filter layered on top of the panel filters (never a client-side
 * slice of the unfiltered payload, unlike the retired standalone LeadsReport) — so
 * its nine KPI cards, its axis bars and its drill lists are all real, all narrowed to
 * the same population. The lead-like phase is resolved off the FLAG the backend
 * itself uses to identify it (`is_default && !is_applicant`, mirrors
 * CandidatesReport.php's own valueDistribution()) — never a hardcoded 'lead' slug, a
 * tenant may rename it. The default Kandidaten position is BYTE-IDENTICAL to the old
 * standalone candidates report (no filter added) so every existing deep link/behaviour
 * keeps working unchanged. 'sources' also retired into this page (RAPPORTEN-CONSOLIDATIE-1)
 * — not as a switch position, but because the Source axis section below already IS
 * what the standalone Sources page existed to show for candidate inflow.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import ReportSwitchBar from './ReportSwitchBar'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useCandidatesReport } from './useCandidatesReport'
import { useReportSwitch } from './useReportSwitch'
import { useLookups } from '@/context/LookupsContext'
import { gateDrillClick } from './reportDrillGate'
import { buildAxisKpis } from './buildAxisKpis'
import type { AxisKpiConfig } from './buildAxisKpis'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import type { ReportKpiScopeId } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

// The five drillable axes; `param` is the XOR query key the drill/advice endpoints expect.
type Axis = 'status' | 'phase' | 'source' | 'owner' | 'branch'

// The two switch positions — also the KPI-catalog/settings-scope id and the
// i18n namespace-prefix for the population-facing strings (total/series/window/
// loading/error/empty). Axis labels stay on the shared `candidates.axes.*` keys
// regardless of position — the axis MEANING never changes, only the population.
// Kept as plain `string` on the wire (not a narrower literal union) so this
// component satisfies ReportsPage's one shared `ReportComponent` contract
// (initialView?: string) — useReportSwitch constrains the runtime value to one
// of `positions` regardless of the declared type.
const VIEWS = ['candidates', 'leads'] as const

export default function CandidatesReport({ period, filters = EMPTY_REPORT_FILTERS, initialView = 'candidates' }: {
  period: ReportPeriod
  filters?: ReportFilterState
  initialView?: string
}) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { phases } = useLookups()
  const [view, setView] = useReportSwitch(VIEWS, initialView)
  const isLeads = view === 'leads'

  // Flag-driven, never a hardcoded slug (§3B) — mirrors the backend's own
  // "which phase counts as a lead" resolution exactly.
  const leadPhaseValue = phases.find(p => p.is_default && !p.is_applicant)?.value
    ?? phases.find(p => !p.is_applicant)?.value ?? null
  const phaseFilter = isLeads ? leadPhaseValue : null

  const { data, loading, error, refetch } = useCandidatesReport(period, filters, phaseFilter)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: every axis section and the timeseries own an ALWAYS-VISIBLE list
  // beside their chart (ReportChartWithDrillList) instead of a shared overlay — so
  // one key per section, never a single global `drill`. Exactly one XOR param per
  // open drill — ALWAYS layered on top of the report's own active filters
  // (`baseParams`), never just `period`, so the list counts the exact same set the
  // bar was drawn from. `baseParams` also carries the switch's own `phase` filter,
  // so a Leads-position drill list always describes the exact same rows its bars do.
  type DrillKey = Axis | 'series'
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const baseParams = { ...buildReportQueryParams(period, 'candidates', filters), ...(phaseFilter ? { phase: phaseFilter } : {}) }
  const openSegment = (key: DrillKey, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
      rowsEndpoint: '/reports/candidates/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/candidates/advice', adviceParams: { ...baseParams, ...xorParam },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    // A week bar's `date` is the point's own key; the list then counts the WHOLE
    // week (bucket=week) so bar and list total always agree.
    rowsEndpoint: '/reports/candidates/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/candidates/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  } }))

  const bars = (axis: Axis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('candidates', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('candidates', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment('owner', { label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('candidates', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Default each section's list to its own top segment on mount so no panel is
  // ever blank — mirrors clicking that segment's own bar, never a client-side guess.
  useEffect(() => {
    if (!data) return
    const top = <T,>(segs: T[], count: (s: T) => number) => segs.length ? segs.reduce((a, b) => (count(b) > count(a) ? b : a)) : null
    const topStatus = top(data.by_status, s => s.count)
    const topPhase = top(data.by_phase, s => s.count)
    const topSource = top(data.by_source, s => s.count)
    const topOwner = top(data.by_owner, s => s.count)
    const topBranch = top(data.by_branch, s => s.count)
    if (topStatus) openSegment('status', topStatus, { status: topStatus.value })
    if (topPhase) openSegment('phase', topPhase, { phase: topPhase.value })
    if (topSource) openSegment('source', topSource, { source: topSource.value })
    if (topOwner) openSegment('owner', { label: topOwner.name, count: topOwner.count }, { owner: topOwner.owner_id })
    if (topBranch) openSegment('branch', topBranch, { branch: topBranch.value })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

  // Nine-card KPI strip (Danny — same footprint as the dashboard): "total" plus
  // eight axis-derived cards, all real counts from the five axes already on the
  // response (§0 no fake affordances — nothing here is invented or hardcoded).
  // WHICH axes participate, and in what priority order, is the tenant's Settings →
  // Reports choice PER SWITCH POSITION ("total" itself stays pinned —
  // RAPPORT-KPI-INSTELBAAR) — Kandidaten and Leads keep independently configurable
  // catalogs/orders (`kpiScope`), never one shared setting the two positions fight over.
  const allAxisConfigs: Record<Axis, AxisKpiConfig> = {
    status: { axis: 'status', axisLabel: t('candidates.axes.status'), segs: (data?.by_status ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    phase:  { axis: 'phase',  axisLabel: t('candidates.axes.phase'),  segs: (data?.by_phase ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    source: { axis: 'source', axisLabel: t('candidates.axes.source'), segs: (data?.by_source ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    owner:  { axis: 'owner',  axisLabel: t('candidates.axes.owner'),  segs: (data?.by_owner ?? []).map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    branch: { axis: 'branch', axisLabel: t('candidates.axes.branch'), segs: (data?.by_branch ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
  }
  // `view` is constrained to VIEWS at runtime (useReportSwitch); both members
  // are valid KPI-catalog scope ids (kpiCatalog.ts), so the cast is safe.
  const kpiScope = view as ReportKpiScopeId
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog(kpiScope).map(c => c.key)
  const defaultAxisOrder = getReportKpiDefaultOrder(kpiScope)
  const storedAxisOrder = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey(kpiScope), undefined)
  const { order: axisOrder, fellBack } = resolveReportKpiOrder(storedAxisOrder, catalogKeys, defaultAxisOrder)
  const axisConfigs: AxisKpiConfig[] = axisOrder.map(axis => allAxisConfigs[axis as Axis]).filter(Boolean)
  // A KPI card for an axis segment fills THAT axis's own list, exactly like
  // clicking the bar itself — never a shared overlay.
  const onAxisKpiPick = gateDrillClick('candidates', (axis: string, key: string) => {
    const cfg = axisConfigs.find(c => c.axis === axis)
    const seg = cfg?.segs.find(s => s.key === key)
    if (seg) openSegment(axis as Axis, { label: seg.label, count: seg.count }, { [axis]: key })
  })
  const axisKpis = buildAxisKpis(axisConfigs, 8,
    (axis, key) => onAxisKpiPick?.(axis, key),
    (axis, key) => (drills[axis as Axis]?.rowsParams as Record<string, unknown> | undefined)?.[axis] === key)

  // "Total" seeds every axis's list back to its own top segment (mirrors the
  // mount default) — there is no single "total" drill anymore, each section
  // keeps its own state. Card 1's label/window/loading/empty/error text is
  // scoped to the active position — the Kandidaten position keeps today's exact
  // "Total inflow" wording (a byte-identical default, zero regression), Leads
  // gets its own "Total leads" wording.
  const kpis: KpiSpec[] = [
    { key: 'total', label: t(isLeads ? 'leads.total' : 'candidates.total'), value: total },
    ...axisKpis,
  ]

  return (
    <div>
      <ReportSwitchBar ariaLabel={t('candidates.viewSwitch.ariaLabel')} value={view} onChange={setView}
        options={[
          { value: 'candidates', label: t('candidates.viewSwitch.candidates') },
          { value: 'leads', label: t('candidates.viewSwitch.leads') },
        ]} />

      {/* KPI strip — total inflow, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t(isLeads ? 'leads.kpiOrderFellBack' : 'candidates.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B).
          A window that is invisible in the UI reads as a "report ≠ list" support ticket. */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t(isLeads ? 'leads.window' : 'candidates.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t(isLeads ? 'leads.loading' : 'candidates.loading')}
          errorLabel={t(isLeads ? 'leads.error' : 'candidates.error')}
          emptyLabel={t(isLeads ? 'leads.empty' : 'candidates.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Inflow over time — week/day timeseries, bucket set server-side. Its own
                always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t(isLeads ? 'leads.series' : 'candidates.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t(isLeads ? 'leads.series' : 'candidates.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.status')}</h3>
              <ReportChartWithDrillList drill={drills.status ?? null} placeholderLabel={t('candidates.axes.status')}
                chart={bars('status', data.by_status)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.phase')}</h3>
              <ReportChartWithDrillList drill={drills.phase ?? null} placeholderLabel={t('candidates.axes.phase')}
                chart={bars('phase', data.by_phase)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.source')}</h3>
              <ReportChartWithDrillList drill={drills.source ?? null} placeholderLabel={t('candidates.axes.source')}
                chart={bars('source', data.by_source)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.owner')}</h3>
              <ReportChartWithDrillList drill={drills.owner ?? null} placeholderLabel={t('candidates.axes.owner')}
                chart={ownerBars(data.by_owner)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.branch')}</h3>
              <ReportChartWithDrillList drill={drills.branch ?? null} placeholderLabel={t('candidates.axes.branch')}
                chart={bars('branch', data.by_branch)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
