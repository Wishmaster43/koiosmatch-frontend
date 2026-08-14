/**
 * FlowReport — the application funnel report (GET /reports/flow).
 *
 * Dual view: when the cohort source has data it renders the real funnel on
 * `reached_count` (distinct applications that ever reached each stage) with the
 * honest `conversion_rate`; while the cohort is still filling it falls back to the
 * `current_count` pipeline occupancy. Phases come from tenant funnel lookups, so we
 * never hardcode stage names — we key on `key` and render `label`.
 */
import { useMemo, useState } from 'react'
import { formatRatio } from '@/lib/formatters'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import ReportStateBlock from './ReportStateBlock'
import { reportCardStyle } from './ReportSectionCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useFlowReport } from './useFlowReport'
import { gateDrillClick } from './reportDrillGate'
import type { ReportPeriod, FlowPhase } from '@/types/analytics'

// One funnel row: label, proportional bar, count and (cohort only) conversion + avg days.
function PhaseRow({ label, value, max, index, conversion, avgDays }: {
  label: string; value: number; max: number; index: number; conversion: string | null; avgDays: string | null
}) {
  const width = Math.max(2, Math.round((value / max) * 100))
  // Calm: one accent hue, fading down the funnel — colour carries position, not decoration.
  const opacity = Math.max(0.35, 1 - index * 0.16)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <div style={{ width: 140, flexShrink: 0, fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 26, borderRadius: 6, background: 'var(--hover-bg)', overflow: 'hidden' }}>
          <div style={{ width: `${width}%`, height: '100%', borderRadius: 6,
                        background: 'var(--color-primary)', opacity, transition: 'width 0.3s' }} />
        </div>
        <div style={{ width: 56, flexShrink: 0, textAlign: 'right', fontSize: 13, fontWeight: 600,
                      color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <div style={{ width: 64, flexShrink: 0, textAlign: 'right', fontSize: 12,
                      color: conversion ? 'var(--color-primary)' : 'transparent', fontVariantNumeric: 'tabular-nums' }}>
          {conversion ?? '—'}
        </div>
      </div>
      <div style={{ width: 120, flexShrink: 0, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
        {avgDays ?? ''}
      </div>
    </div>
  )
}

export default function FlowReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { data, loading, error, refetch } = useFlowReport(period)

  // Cohort is "ready" once any stage has been reached; else show pipeline-now.
  const cohortReady = useMemo(() => !!data?.phases.some(p => p.reached_count > 0), [data])

  const phases = data?.phases ?? []
  const values = phases.map(p => (cohortReady ? p.reached_count : p.current_count))
  const max    = Math.max(...values, 1)

  // Overall conversion = last reached / first reached (cohort only).
  const overallConv = useMemo(() => {
    if (!cohortReady || phases.length < 2) return null
    const first = phases[0].reached_count
    const last  = phases[phases.length - 1].reached_count
    return first > 0 ? last / first : null
  }, [cohortReady, phases])

  // Drill-down: which KPI is being explained (null = closed).
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const pct = (v: number | null) => (v != null ? formatRatio(v) : undefined)

  // One clickable KPI block per funnel phase; clicking explains the number
  // (breakdown + the applications behind it + Koios advice).
  const phaseKpi = (p: FlowPhase): KpiSpec => {
    const value = cohortReady ? p.reached_count : p.current_count
    return {
      key: p.key, label: p.label, value, sub: pct(p.conversion_rate),
      active: drill?.rowsParams?.phase === p.key,
      // Drill endpoints don't exist yet (reportDrillGate) — no click affordance until they do.
      onClick: gateDrillClick('flow', () => setDrill({
        title: p.label, value, subtitle: t(`period.${period}`),
        breakdown: [
          { label: t('flow.reached'), value: p.reached_count },
          { label: t('flow.current'), value: p.current_count },
          ...(p.conversion_rate != null ? [{ label: t('flow.conversion'), value: pct(p.conversion_rate)! }] : []),
        ],
        rowsEndpoint: '/reports/flow/drill', rowsParams: { phase: p.key, period, view: cohortReady ? 'reached' : 'current' },
        adviceEndpoint: '/reports/flow/advice', adviceParams: { phase: p.key, period, view: cohortReady ? 'reached' : 'current' },
      })),
    }
  }

  // Overall drop-off = applications lost between the first and last reached stage
  // (cohort only — the pipeline-now counts aren't a cohort, so no honest drop-off
  // exists while it fills). Average days-in-phase is the mean of the phases that
  // carry a real value — both are plain stats, not a single segment, so neither drills.
  const dropOff = useMemo(() => {
    if (!cohortReady || phases.length < 2) return null
    const first = phases[0].reached_count
    const last  = phases[phases.length - 1].reached_count
    return first - last
  }, [cohortReady, phases])
  const avgDaysOverall = useMemo(() => {
    const withDays = phases.filter(p => p.avg_days_in_phase != null)
    if (withDays.length === 0) return null
    return withDays.reduce((s, p) => s + (p.avg_days_in_phase ?? 0), 0) / withDays.length
  }, [phases])

  // The stage a real drop happens FROM the most (cohort only, ≥2 phases) — a
  // fixed, always-computable summary card instead of one card per tenant
  // funnel stage (that was the unbounded strip: 5, 8, 10+ cards depending on
  // how many stages a tenant configured). The per-stage detail still lives in
  // the funnel rows below; this card is one honest headline number.
  const maxDropPhase = useMemo(() => {
    if (!cohortReady || phases.length < 2) return null
    let best: { label: string; drop: number } | null = null
    for (let i = 0; i < phases.length - 1; i++) {
      const drop = phases[i].reached_count - phases[i + 1].reached_count
      if (!best || drop > best.drop) best = { label: phases[i].label, drop }
    }
    return best && best.drop > 0 ? best : null
  }, [cohortReady, phases])

  // Real, always-available counts that don't depend on which/how many stages
  // the tenant configured: how many stages actually saw activity vs. the
  // total stage count.
  const stagesReached = phases.filter(p => (cohortReady ? p.reached_count : p.current_count) > 0).length
  const stagesTotal = phases.length
  const firstPhase = phases[0] ?? null
  const lastPhase = phases.length > 0 ? phases[phases.length - 1] : null

  // Exactly nine cards, always (Danny — the strip's footprint never reflows
  // between pages, and it must never grow with the tenant's funnel stage
  // count). Every value here is either a real total/derived-subtraction, or
  // the house dash while cohort data isn't ready yet — never a fabricated 0.
  const kpis: KpiSpec[] = [
    { key: 'total', label: t('flow.total'), value: data?.total ?? 0,
      active: drill != null && drill.rowsParams?.phase == null && drill.rowsEndpoint === '/reports/flow/drill',
      onClick: gateDrillClick('flow', () => setDrill({
        title: t('flow.total'), value: data?.total ?? 0, subtitle: t(`period.${period}`),
        breakdown: phases.map(p => ({ label: p.label, value: cohortReady ? p.reached_count : p.current_count })),
        rowsEndpoint: '/reports/flow/drill', rowsParams: { period, view: cohortReady ? 'reached' : 'current' },
        adviceEndpoint: '/reports/flow/advice', adviceParams: { period, view: cohortReady ? 'reached' : 'current' },
      })) },
    { key: 'firstPhase', label: t('flow.firstPhase'),
      value: firstPhase ? (cohortReady ? firstPhase.reached_count : firstPhase.current_count) : '—', sub: firstPhase?.label,
      onClick: firstPhase ? phaseKpi(firstPhase).onClick : undefined },
    { key: 'lastPhase', label: t('flow.lastPhase'),
      value: lastPhase ? (cohortReady ? lastPhase.reached_count : lastPhase.current_count) : '—', sub: lastPhase?.label,
      onClick: lastPhase ? phaseKpi(lastPhase).onClick : undefined },
    { key: 'conv', label: t('flow.overallConversion'), value: overallConv != null ? formatRatio(overallConv) : '—' },
    { key: 'dropOff', label: t('flow.dropOff'), value: dropOff ?? '—' },
    { key: 'avgDaysOverall', label: t('flow.avgDaysOverall'),
      value: avgDaysOverall != null ? t('flow.avgDays', { days: Math.round(avgDaysOverall) }) : '—' },
    { key: 'maxDropPhase', label: t('flow.maxDropPhase'), value: maxDropPhase?.drop ?? '—', sub: maxDropPhase?.label },
    { key: 'stagesReached', label: t('flow.stagesReached'), value: stagesReached },
    { key: 'stagesTotal', label: t('flow.stagesTotal'), value: stagesTotal },
  ]

  return (
    <div>
      {/* KPI strip — sits above the tabs (candidate-page order: KPIs first) */}
      {!loading && !error && phases.length > 0 && (
        <ReportKpiBand kpis={kpis} />
      )}

      {/* Cohort-filling note (pipeline fallback) */}
      {!loading && !error && phases.length > 0 && !cohortReady && (
        <div style={{ fontSize: 12, color: 'var(--color-warning)', background: 'var(--color-warning-bg)',
                      border: '1px solid var(--color-warning)', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
          {t('flow.cohortNote')}
        </div>
      )}

      {/* Funnel card — handles the four UI states */}
      <div style={{ ...reportCardStyle, padding: 20 }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && phases.length === 0}
          loadingLabel={t('flow.loading')} errorLabel={t('flow.error')} emptyLabel={t('flow.empty')}
          onRetry={() => refetch()}
        />
        {!loading && !error && phases.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, fontWeight: 700,
                          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 4 }}>
              <span style={{ width: 140, flexShrink: 0 }}>{t('flow.phase')}</span>
              <span style={{ flex: 1 }}>{cohortReady ? t('flow.reached') : t('flow.current')}</span>
              <span style={{ width: 64, flexShrink: 0, textAlign: 'right' }}>{cohortReady ? t('flow.conversion') : ''}</span>
              <span style={{ width: 120, flexShrink: 0 }} />
            </div>
            {phases.map((p, i) => {
              // Same gate as the KPI cards: no click/cursor/tooltip until the drill endpoint exists.
              const onPhaseClick = phaseKpi(p).onClick
              return (
              <div key={p.key} onClick={onPhaseClick} style={{ cursor: onPhaseClick ? 'pointer' : 'default' }}
                   title={onPhaseClick ? t('drill.breakdown') : undefined}>
                <PhaseRow
                  label={p.label}
                  value={cohortReady ? p.reached_count : p.current_count}
                  max={max}
                  index={i}
                  conversion={cohortReady && p.conversion_rate != null ? formatRatio(p.conversion_rate) : null}
                  avgDays={p.avg_days_in_phase != null ? t('flow.avgDays', { days: Math.round(p.avg_days_in_phase) }) : null}
                />
              </div>
              )
            })}
          </>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked number + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
