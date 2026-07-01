/**
 * FlowReport — the application funnel report (GET /reports/flow).
 *
 * Dual view: when the cohort source has data it renders the real funnel on
 * `reached_count` (distinct applications that ever reached each stage) with the
 * honest `conversion_rate`; while the cohort is still filling it falls back to the
 * `current_count` pipeline occupancy. Phases come from tenant funnel lookups, so we
 * never hardcode stage names — we key on `key` and render `label`.
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import { useFlowReport } from './useFlowReport'
import type { ReportPeriod } from '@/types/analytics'

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

export default function FlowReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { data, loading, error } = useFlowReport(period)

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

  const kpis: KpiSpec[] = [
    { key: 'total', label: t('flow.total'), value: data?.total ?? 0 },
    ...(overallConv != null
      ? [{ key: 'conv', label: t('flow.overallConversion'), value: `${Math.round(overallConv * 100)}%` } as KpiSpec]
      : []),
  ]

  return (
    <div>
      {/* KPI strip — sits above the tabs (candidate-page order: KPIs first) */}
      {!loading && !error && phases.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* Cohort-filling note (pipeline fallback) */}
      {!loading && !error && phases.length > 0 && !cohortReady && (
        <div style={{ fontSize: 12, color: 'var(--color-warning)', background: 'var(--color-warning-bg)',
                      border: '1px solid var(--color-warning)', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>
          {t('flow.cohortNote')}
        </div>
      )}

      {/* Funnel card — handles the four UI states */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 20 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>{t('flow.loading')}</div>
        )}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--color-danger)' }}>{t('flow.error')}</div>
        )}
        {!loading && !error && phases.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>{t('flow.empty')}</div>
        )}
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
            {phases.map((p, i) => (
              <PhaseRow
                key={p.key}
                label={p.label}
                value={cohortReady ? p.reached_count : p.current_count}
                max={max}
                index={i}
                conversion={cohortReady && p.conversion_rate != null ? `${Math.round(p.conversion_rate * 100)}%` : null}
                avgDays={p.avg_days_in_phase != null ? t('flow.avgDays', { days: Math.round(p.avg_days_in_phase) }) : null}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
