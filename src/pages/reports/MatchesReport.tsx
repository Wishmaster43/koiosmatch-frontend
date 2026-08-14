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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useMatchesReport } from './useMatchesReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateTimeseriesPoint } from '@/types/analytics'

// One match stat tile; with an onClick it becomes a drillable surface (keyboard
// operable — same affordance pattern as SegmentBars).
function StatTile({ label, value, accent, onClick }: { label: string; value: number; accent?: boolean; onClick?: () => void }) {
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
         onClick={onClick}
         onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
         style={{ flex: 1, minWidth: 120, padding: '14px 16px', borderRadius: 10, background: 'var(--bg)',
                  border: '1px solid var(--border)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                    color: accent ? 'var(--color-primary-text)' : 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// The under_contract tile keys — each drills contract_status=<key> (portie 7 XOR).
const CONTRACT_STATUS_TILES = ['sent', 'active', 'ended', 'none'] as const

export default function MatchesReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error } = useMatchesReport(period)
  const isEmpty = !loading && !error && (!data || data.total === 0)

  // Drill-down: clicking a KPI/segment/tile/bucket explains it (breakdown + the
  // matches behind it + Koios advice). Exactly one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  // The report window from the RESPONSE, DD-MM-YYYY (§3B DATUM-1) — drawer subtitle.
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openMatches = (title: string, value: number, origin?: 'funnel' | 'direct') => setDrill({
    title, value, subtitle: windowSub(),
    breakdown: [
      { label: t('matches.viaFunnel'), value: data?.by_origin.funnel ?? 0 },
      { label: t('matches.direct'),    value: data?.by_origin.direct ?? 0 },
    ],
    rowsEndpoint: '/reports/matches/drill', rowsParams: { origin, period },
    adviceEndpoint: '/reports/matches/advice', adviceParams: { origin, period },
  })

  // Soort-as (MATCH-SOORT-1): by_contract_form bars — `contract_form` is one leg
  // of the four-way XOR; drill AND advice both carry it (the advice gap the
  // backend closed in portie 7 — labels read "Contractvorm: …" server-side).
  const openContractForm = (label: string, value: number, slug: string) => setDrill({
    title: label, value, subtitle: windowSub(),
    rowsEndpoint: '/reports/matches/drill', rowsParams: { contract_form: slug, period },
    adviceEndpoint: '/reports/matches/advice', adviceParams: { contract_form: slug, period },
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
    rowsEndpoint: '/reports/matches/drill', rowsParams: { contract_status: key, period },
    adviceEndpoint: '/reports/matches/advice', adviceParams: { contract_status: key, period },
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
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/matches/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })
  const seriesMax = (data?.timeseries.series ?? []).reduce((m, p) => Math.max(m, p.value), 0)
  const onSeriesPick = gateDrillClick('matches', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Terminations by stop reason — stop_reason is the FIFTH XOR leg (7925ce15).
  // The axis is windowed on the termination EVENT server-side, so the drawer shows
  // the matches whose termination fell in the window: drawer == bar, always.
  const terminationSegs = data?.terminations.by_reason ?? []
  const terminationsMax = terminationSegs.reduce((m, s) => Math.max(m, s.count), 0)
  const openReason = gateDrillClick('matches', (value: string) => {
    const seg = terminationSegs.find(s => s.value === value)
    setDrill({
      title: seg?.label ?? value, value: seg?.count ?? 0, subtitle: windowSub(),
      rowsEndpoint: '/reports/matches/drill', rowsParams: { stop_reason: value, period },
      adviceEndpoint: '/reports/matches/advice', adviceParams: { stop_reason: value, period },
    })
  })

  // The XOR axis of the OPEN drill (if any) — drives the KPI active states.
  const openParams = drill?.rowsParams as Record<string, unknown> | undefined
  const openAxis = openParams ? ['origin', 'contract_form', 'contract_status', 'date', 'stop_reason'].find(k => openParams[k] != null) : undefined

  const kpis: KpiSpec[] = [
    { key: 'total',  label: t('matches.total'),     value: data?.total ?? 0,
      active: drill != null && openAxis == null,
      onClick: gateDrillClick('matches', () => openMatches(t('matches.total'), data?.total ?? 0)) },
    { key: 'funnel', label: t('matches.viaFunnel'), value: data?.by_origin.funnel ?? 0,
      active: openParams?.origin === 'funnel',
      onClick: gateDrillClick('matches', () => openMatches(t('matches.viaFunnel'), data?.by_origin.funnel ?? 0, 'funnel')) },
    { key: 'direct', label: t('matches.direct'),    value: data?.by_origin.direct ?? 0,
      active: openParams?.origin === 'direct',
      onClick: gateDrillClick('matches', () => openMatches(t('matches.direct'), data?.by_origin.direct ?? 0, 'direct')) },
    { key: 'dur',    label: t('matches.avgDuration'),
      value: data?.avg_placement_duration_days != null ? t('matches.daysValue', { days: Math.round(data.avg_placement_duration_days) }) : '—' },
  ]

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order: KPIs first) */}
      {!loading && !error && !isEmpty && data && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('matches.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)',
                      background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {t('matches.loading')}
        </div>
      )}
      {error && !loading && (
        <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--color-danger)',
                      background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {t('matches.error')}
        </div>
      )}
      {isEmpty && (
        <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)',
                      background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {t('matches.empty')}
        </div>
      )}

      {!loading && !error && !isEmpty && data && (
        <>
          {/* Matches over time — week/day timeseries, bucket set server-side;
              every bar drills on its own date key (portie 7). */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('matches.series')}</div>
            <SegmentBars max={seriesMax} onPick={onSeriesPick}
              items={data.timeseries.series.map(p => ({ key: p.date, label: p.label, count: p.value, color: null }))} />
          </div>

          {/* Soort-as (MATCH-SOORT-1): by_contract_form bars, sums to total incl. the
              'none' sentinel and any orphaned slug — SegmentBars needs no special-casing. */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('matches.axes.contractForm')}</div>
            <SegmentBars max={contractFormMax} onPick={onContractFormPick}
              items={contractFormSegs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
          </div>

          {/* Contract-status tiles (under_contract, MATCH-VOCABULAIRE-1): the four
              tiles sum to the report total and each drills contract_status=<key>. */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('matches.placements.title')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {CONTRACT_STATUS_TILES.map(key => (
                <StatTile key={key} label={t(`matches.placements.${key}`)} value={tileValue(key)} accent={key === 'active'}
                  onClick={gateDrillClick('matches', () => openContractStatus(t(`matches.placements.${key}`), tileValue(key), key))} />
              ))}
            </div>
            {data.avg_placement_duration_days == null && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>{t('matches.durationNote')}</p>
            )}
          </div>

          {/* Terminations by stop reason — zero-filled over every active reason;
              each bar drills stop_reason=<value> (fifth XOR leg, 7925ce15). */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>{t('matches.terminations.title')}</div>
            <SegmentBars max={terminationsMax} onPick={openReason}
              items={terminationSegs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
          </div>
        </>
      )}

      {/* Dynamic drill-down: explains the clicked number + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
