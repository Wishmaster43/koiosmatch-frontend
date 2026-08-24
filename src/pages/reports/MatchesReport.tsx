/**
 * MatchesReport — matches summary (GET /reports/matches, closed by RAPPORTEN-SUITE-1
 * "portie 7"). KPI strip (total · via-funnel vs direct) + the shared timeseries,
 * the contract-form axis (MATCH-SOORT-1), the under_contract contract-status tiles
 * and the terminations-by-reason axis, window label from the RESPONSE. Drill/advice
 * XOR params follow the four-way matches contract: origin | contract_form |
 * contract_status | date (+bucket=week next to a week bar's date).
 * `avg_placement_duration_days` is honestly null until the HelloFlex coupling
 * fills match start/end — we show a note rather than a fabricated number.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import ReportStateBlock from './ReportStateBlock'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useMatchesReport } from './useMatchesReport'
import { gateDrillClick } from './reportDrillGate'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import { formatPercent } from '@/lib/formatters'
import type { ReportPeriod, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import SharedStatTile from '@/components/ui/StatTile'
import { BodyText } from '@/components/ui/typography'

// One match stat tile; with an onClick it becomes a drillable surface (keyboard
// operable — same affordance pattern as SegmentBars).
// The shared StatTile atom (klus c) — value-first, clickable, accent for the live bucket.
function StatTile({ label, value, accent, onClick }: { label: string; value: number; accent?: boolean; onClick?: () => void }) {
  return <SharedStatTile label={label} value={value} accent={accent} onClick={onClick} />
}

// The under_contract tile keys — each drills contract_status=<key> (portie 7 XOR).
const CONTRACT_STATUS_TILES = ['sent', 'active', 'ended', 'none'] as const

export default function MatchesReport({ period, filters = EMPTY_REPORT_FILTERS, compare = COMPARE_OFF }: { period: ReportPeriod; filters?: ReportFilterState; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useMatchesReport(period, filters)
  const isEmpty = !loading && !error && (!data || data.total === 0)

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('matches')
  const compareBaseParams = { ...buildReportQueryParams(period, 'matches', filters) }
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compare, compareBaseParams)
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // Drill-down: clicking a KPI/segment/tile/bucket explains it (breakdown + the
  // matches behind it + Koios advice). Exactly one XOR param per open drill —
  // ALWAYS layered on top of the report's own active filters (`baseParams`), never
  // just `period`, so the lade counts the exact same set the bar was drawn from.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  // The report window from the RESPONSE, DD-MM-YYYY (§3B DATUM-1) — drawer subtitle.
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const baseParams = buildReportQueryParams(period, 'matches', filters)
  const openMatches = (title: string, value: number, origin?: 'funnel' | 'direct') => setDrill({
    title, value, subtitle: windowSub(),
    breakdown: [
      { label: t('matches.viaFunnel'), value: data?.by_origin.funnel ?? 0 },
      { label: t('matches.direct'),    value: data?.by_origin.direct ?? 0 },
    ],
    rowsEndpoint: '/reports/matches/drill', rowsParams: { ...baseParams, origin },
    adviceEndpoint: '/reports/matches/advice', adviceParams: { ...baseParams, origin },
  })

  // Soort-as (MATCH-SOORT-1): by_contract_form bars — `contract_form` is one leg
  // of the four-way XOR; drill AND advice both carry it (the advice gap the
  // backend closed in portie 7 — labels read "Contractvorm: …" server-side).
  const openContractForm = (label: string, value: number, slug: string) => setDrill({
    title: label, value, subtitle: windowSub(),
    rowsEndpoint: '/reports/matches/drill', rowsParams: { ...baseParams, contract_form: slug },
    adviceEndpoint: '/reports/matches/advice', adviceParams: { ...baseParams, contract_form: slug },
  })
  const contractFormSegs = data?.by_contract_form ?? []
  const contractFormMax = contractFormSegs.reduce((m, s) => Math.max(m, s.count), 0)
  const onContractFormPick = gateDrillClick('matches', (value: string) => {
    const seg = contractFormSegs.find(s => s.value === value)
    if (seg) openContractForm(seg.label, seg.count, seg.value)
  })

  // Under-contract tile drill: `contract_status` is the third XOR leg (portie 7).
  const openContractStatus = (label: string, value: number, key: (typeof CONTRACT_STATUS_TILES)[number]) => setDrill({
    title: label, value, subtitle: windowSub(),
    rowsEndpoint: '/reports/matches/drill', rowsParams: { ...baseParams, contract_status: key },
    adviceEndpoint: '/reports/matches/advice', adviceParams: { ...baseParams, contract_status: key },
  })
  // 'none' now arrives explicitly in the envelope (7925ce15); the old derivation
  // stays as fallback for a cached pre-update response, never fabricated.
  const noContract = data?.under_contract.none ?? Math.max(0, (data?.total ?? 0) - (data?.under_contract.total ?? 0))
  const tileValue = (key: (typeof CONTRACT_STATUS_TILES)[number]) =>
    key === 'none' ? noContract : data?.under_contract[key] ?? 0

  // Timeseries bucket drill: `date` is the fourth XOR leg; a week bar widens the
  // drawer to the WHOLE week (bucket=week) so bar and drawer totals always agree.
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    rowsEndpoint: '/reports/matches/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/matches/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })
  const onSeriesPick = gateDrillClick('matches', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Terminations by stop reason — stop_reason is the FIFTH XOR leg (7925ce15).
  // The axis is windowed on the termination EVENT server-side, so the drawer shows
  // the matches whose termination fell in the window: drawer == bar, always.
  const terminationSegs = data?.terminations.by_reason ?? []
  const terminationsMax = terminationSegs.reduce((m, s) => Math.max(m, s.count), 0)
  // RAPPORT-KAARTDRILLS-2: per-KPI-card drill via GET /reports/matches/kpis/drill?kpi=<key>
  // (MatchesKpiDrillRequest enum: total|new_in_period|active|expiring_soon|
  // terminated_in_period|renewals_in_period|without_end_date|avg_duration_days|
  // reach_rate, measured in api-generated.ts). Only the pairs that measurably
  // mean the same thing are mapped (never guessed) — `total` and `active`
  // already open a real XOR drill above (full-population, with a breakdown) and
  // stay untouched; `funnel`/`direct`/`sent`/`ended`/`terminationRate` have no
  // matching server kpi (new_in_period/expiring_soon/renewals_in_period/
  // without_end_date/reach_rate mean something else) so they keep no onClick.
  const KPI_DRILL_KEY: Partial<Record<string, string>> = {
    // terminated_in_period is the one hard-confirmed identical pair
    // (BuildsMatchKpis reuses terminationRows() verbatim).
    terminationsTotal: 'terminated_in_period',
    // dur mirrors avg_placement_duration_days's own concept (average contract
    // duration); now that the kpi suite carries avg_duration_days, the card
    // reads it the moment the server fills it (the envelope field stays null
    // until the HelloFlex coupling lands — see the fallback below).
    // POPULATION NOTE: the suite number averages matches TERMINATED in the
    // window that carry a start_date (BuildsMatchKpis::avgDurationDays), not an
    // all-placements average — the drill lists exactly that population.
    dur: 'avg_duration_days',
  }
  const kpiByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.count]))
  const openKpiDrill = (localKey: string, label: string, value: string | number) => {
    const serverKey = KPI_DRILL_KEY[localKey]
    if (!serverKey) return undefined
    return gateDrillClick('matches', () => setDrill({
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/matches/kpis/drill', rowsParams: { ...baseParams, kpi: serverKey },
    }))
  }
  // Tolerant fallback: the server kpi VALUE wins when the strip carries that
  // key, otherwise the legacy envelope value renders WITHOUT a drill.
  const terminationsWired = kpiByServerKey.has('terminated_in_period')
  const terminationsValue = terminationsWired ? (kpiByServerKey.get('terminated_in_period') ?? 0) : (data?.terminations.total ?? 0)
  const durWired = kpiByServerKey.has('avg_duration_days')
  const durRaw = durWired ? kpiByServerKey.get('avg_duration_days') : data?.avg_placement_duration_days
  const durValue = durRaw != null ? t('matches.daysValue', { days: Math.round(durRaw) }) : '—'

  const openReason = gateDrillClick('matches', (value: string) => {
    const seg = terminationSegs.find(s => s.value === value)
    setDrill({
      title: seg?.label ?? value, value: seg?.count ?? 0, subtitle: windowSub(),
      rowsEndpoint: '/reports/matches/drill', rowsParams: { ...baseParams, stop_reason: value },
      adviceEndpoint: '/reports/matches/advice', adviceParams: { ...baseParams, stop_reason: value },
    })
  })

  // The XOR axis of the OPEN drill (if any) — drives the KPI active states.
  const openParams = drill?.rowsParams as Record<string, unknown> | undefined
  const openAxis = openParams ? ['origin', 'contract_form', 'contract_status', 'date', 'stop_reason'].find(k => openParams[k] != null) : undefined

  // Nine-card footprint (Danny — same as the dashboard). The first three mirror
  // the origin axis; sent/active/ended mirror the under_contract tiles below (a
  // real segment total, not a fabricated metric) and drill the same
  // contract_status=<key> XOR leg; the last three are honest, non-fabricated
  // derived stats: terminations total, avg duration (dash until HelloFlex fills
  // it) and the termination rate (a ratio of two real fields).
  const terminationRate = data && data.total > 0 ? (data.terminations.total / data.total) * 100 : null
  // Spare-card sources (REPORTS-KPI-SPARE-1): the top real contract-form/reason
  // segment (excluding the 'none' sentinel — that already has its own card
  // below), an honest ratio of two real counts (funnel share of total), and the
  // fourth under_contract tile ('none' = tileValue('none'), already computed
  // above as `noContract`, just never offered as its own card until now).
  const topContractForm = contractFormSegs.filter(s => s.value !== 'none').sort((a, b) => b.count - a.count)[0]
  const topTerminationReason = terminationSegs.slice().sort((a, b) => b.count - a.count)[0]
  const funnelRate = data && data.total > 0 ? (data.by_origin.funnel / data.total) * 100 : null
  const kpiByKey: Record<string, KpiSpec> = {
    total:  { key: 'total',  label: t('matches.total'),     value: data?.total ?? 0,
      active: drill != null && openAxis == null,
      sub: totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined,
      onClick: gateDrillClick('matches', () => openMatches(t('matches.total'), data?.total ?? 0)) },
    funnel: { key: 'funnel', label: t('matches.viaFunnel'), value: data?.by_origin.funnel ?? 0,
      active: openParams?.origin === 'funnel',
      onClick: gateDrillClick('matches', () => openMatches(t('matches.viaFunnel'), data?.by_origin.funnel ?? 0, 'funnel')) },
    direct: { key: 'direct', label: t('matches.direct'),    value: data?.by_origin.direct ?? 0,
      active: openParams?.origin === 'direct',
      onClick: gateDrillClick('matches', () => openMatches(t('matches.direct'), data?.by_origin.direct ?? 0, 'direct')) },
    sent:   { key: 'sent',   label: t('matches.placements.sent'),   value: tileValue('sent'),
      active: openParams?.contract_status === 'sent',
      onClick: gateDrillClick('matches', () => openContractStatus(t('matches.placements.sent'), tileValue('sent'), 'sent')) },
    active: { key: 'active', label: t('matches.placements.active'), value: tileValue('active'),
      active: openParams?.contract_status === 'active',
      onClick: gateDrillClick('matches', () => openContractStatus(t('matches.placements.active'), tileValue('active'), 'active')) },
    ended:  { key: 'ended',  label: t('matches.placements.ended'),  value: tileValue('ended'),
      active: openParams?.contract_status === 'ended',
      onClick: gateDrillClick('matches', () => openContractStatus(t('matches.placements.ended'), tileValue('ended'), 'ended')) },
    terminationsTotal: { key: 'terminationsTotal', label: t('matches.terminations.total'), value: terminationsValue,
      onClick: terminationsWired ? openKpiDrill('terminationsTotal', t('matches.terminations.total'), terminationsValue) : undefined },
    dur:    { key: 'dur',    label: t('matches.avgDuration'), value: durValue,
      onClick: durWired && durRaw != null ? openKpiDrill('dur', t('matches.avgDuration'), durValue) : undefined },
    terminationRate: { key: 'terminationRate', label: t('matches.terminations.rate'),
      value: formatPercent(terminationRate) },
    // Spares (REPORTS-KPI-SPARE-1): see the derivations above.
    noContract: { key: 'noContract', label: t('matches.summary.noContract'), value: noContract,
      active: openParams?.contract_status === 'none',
      onClick: gateDrillClick('matches', () => openContractStatus(t('matches.summary.noContract'), noContract, 'none')) },
    topContractForm: { key: 'topContractForm', label: t('matches.summary.topContractForm'),
      value: topContractForm ? `${topContractForm.label} · ${topContractForm.count}` : '—',
      onClick: topContractForm ? gateDrillClick('matches', () => openContractForm(topContractForm.label, topContractForm.count, topContractForm.value)) : undefined },
    topTerminationReason: { key: 'topTerminationReason', label: t('matches.terminations.topReason'),
      value: topTerminationReason ? `${topTerminationReason.label} · ${topTerminationReason.count}` : '—',
      onClick: topTerminationReason ? gateDrillClick('matches', () => setDrill({
        title: topTerminationReason.label, value: topTerminationReason.count, subtitle: windowSub(),
        rowsEndpoint: '/reports/matches/drill', rowsParams: { ...baseParams, stop_reason: topTerminationReason.value },
        adviceEndpoint: '/reports/matches/advice', adviceParams: { ...baseParams, stop_reason: topTerminationReason.value },
      })) : undefined },
    funnelRate: { key: 'funnelRate', label: t('matches.summary.funnelRate'),
      value: formatPercent(funnelRate) },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('matches').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('matches')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('matches'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order: KPIs first) */}
      {!loading && !error && !isEmpty && data && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('matches.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). 500 = the top of §4's body/label
          weight range: an emphasized data line, not a heading. */}
      {!loading && !error && data && (
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('matches.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </BodyText>
      )}

      {(loading || error || isEmpty) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={isEmpty}
            loadingLabel={t('matches.loading')} errorLabel={t('matches.error')} emptyLabel={t('matches.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {!loading && !error && !isEmpty && data && (
        <ReportGrid>
          {/* Matches over time — week/day timeseries, bucket set server-side;
              every bar drills on its own date key (portie 7). */}
          <ReportChartCard span={2} title={t('matches.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Soort-as (MATCH-SOORT-1): by_contract_form bars, sums to total incl. the
              'none' sentinel and any orphaned slug — SegmentBars needs no special-casing. */}
          <ReportChartCard title={t('matches.axes.contractForm')} chart={
            <SegmentBars max={contractFormMax} onPick={onContractFormPick}
              items={contractFormSegs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
          } />

          {/* Contract-status tiles (under_contract, MATCH-VOCABULAIRE-1): the four
              tiles sum to the report total and each drills contract_status=<key>. */}
          <ReportChartCard title={t('matches.placements.title')} chart={
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {CONTRACT_STATUS_TILES.map(key => (
                  <StatTile key={key} label={t(`matches.placements.${key}`)} value={tileValue(key)} accent={key === 'active'}
                    onClick={gateDrillClick('matches', () => openContractStatus(t(`matches.placements.${key}`), tileValue(key), key))} />
                ))}
              </div>
              {data.avg_placement_duration_days == null && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>{t('matches.durationNote')}</p>
              )}
            </>
          } />

          {/* Terminations by stop reason — zero-filled over every active reason;
              each bar drills stop_reason=<value> (fifth XOR leg, 7925ce15). */}
          <ReportChartCard title={t('matches.terminations.title')} chart={
            <SegmentBars max={terminationsMax} onPick={openReason}
              items={terminationSegs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
          } />
        </ReportGrid>
      )}

      {/* Dynamic drill-down: explains the clicked number + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
