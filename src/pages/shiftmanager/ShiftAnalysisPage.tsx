/**
 * ShiftAnalysisPage — Kandidaten Shift-analyse (plan Fase A1). A KPI alarm row,
 * a "Geplande UZK per maand" bar chart, and a per-candidate × month matrix with a
 * metric toggle (prognose/werkelijk × uren/diensten) — the app version of Danny's
 * Excel reports. All four UI states; degrades gracefully until the backend feed
 * (/sm_reports/shifts-per-candidate) lands.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, TrendingDown, TrendingUp, UserX, CalendarClock } from 'lucide-react'
import KpiCard from '@/components/ui/KpiCard'
import ErrorBanner from '@/components/ui/ErrorBanner'
import BarChartCard from '@/components/charts/BarChartCard'
import DrillTabs from '@/components/ui/DrillTabs'
import type { ChartDatum } from '@/components/charts/chartTypes'
import ShiftMatrixTable from './ShiftMatrixTable'
import { monthLabel } from './shiftMonth'
import { useShiftAnalysis, METRIC_KEYS, type MetricKey } from './hooks/useShiftAnalysis'

// Centered empty/info block for the unavailable + empty states.
function InfoBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center bg-[var(--surface)] rounded-xl"
      style={{ border: '1px solid var(--border)', minHeight: 220 }}>
      <CalendarClock size={22} style={{ color: 'var(--text-muted)' }} />
      <p className="text-sm text-[var(--text-muted)]" style={{ maxWidth: 420 }}>{text}</p>
    </div>
  )
}

export default function ShiftAnalysisPage() {
  const { t, i18n } = useTranslation('shiftmanager')
  const { rows, monthColumns, matrixRows, plannedPerMonth, loading, error, unavailable } = useShiftAnalysis()
  const [metric, setMetric] = useState<MetricKey>('prognose_hours')

  // Alarm counts drive the KPI cards.
  const counts = useMemo(() => {
    const c = { wegvallend: 0, daling: 0, opkomend: 0, nieuw_inactief: 0 }
    for (const r of rows) if (r.alarm) c[r.alarm] += 1
    return c
  }, [rows])

  // "Geplande UZK per maand" bar data (localized month labels).
  const plannedData: ChartDatum[] = useMemo(
    () => plannedPerMonth.map(p => ({ name: monthLabel(p.month, i18n.language), value: p.count })),
    [plannedPerMonth, i18n.language],
  )
  const metricTabs = METRIC_KEYS.map(k => ({ key: k, label: t(`shiftAnalysis.metric.${k}`) }))

  return (
    <div className="p-6">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
          {t('shiftAnalysis.title')}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{t('shiftAnalysis.subtitle')}</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 bg-[var(--surface)] rounded-xl"
          style={{ border: '1px solid var(--border)', minHeight: 220 }}>
          <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm text-[var(--text-muted)]">{t('shiftAnalysis.loading')}</p>
        </div>
      ) : error ? (
        <ErrorBanner>{t('shiftAnalysis.error')}</ErrorBanner>
      ) : unavailable ? (
        <InfoBlock text={t('shiftAnalysis.unavailable')} />
      ) : (
        <>
          {/* Alarm KPI row */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <KpiCard label={t('shiftAnalysis.kpi.wegvallend')} value={counts.wegvallend}
              icon={TrendingDown} iconBg="var(--color-danger-bg)" iconColor="var(--color-danger)" />
            <KpiCard label={t('shiftAnalysis.kpi.daling')} value={counts.daling}
              icon={TrendingDown} iconBg="var(--color-warning-bg)" iconColor="#C2410C" />
            <KpiCard label={t('shiftAnalysis.kpi.opkomend')} value={counts.opkomend}
              icon={TrendingUp} iconBg="var(--color-success-bg)" iconColor="var(--color-success)" />
            <KpiCard label={t('shiftAnalysis.kpi.nieuwInactief')} value={counts.nieuw_inactief}
              icon={UserX} iconBg="var(--color-warning-bg)" iconColor="var(--color-warning)" />
          </div>

          {matrixRows.length === 0 ? (
            <InfoBlock text={t('shiftAnalysis.empty')} />
          ) : (
            <>
              {/* Geplande UZK per maand */}
              <div className="p-5 mb-6 bg-[var(--surface)] rounded-xl" style={{ border: '1px solid var(--border)' }}>
                <BarChartCard title={t('shiftAnalysis.plannedTitle')} data={plannedData}
                  colors={['var(--color-success)']} height={240} />
              </div>

              {/* Per-candidate matrix + metric toggle */}
              <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('shiftAnalysis.matrixTitle')}</span>
                <DrillTabs tabs={metricTabs} active={metric} onChange={k => setMetric(k as MetricKey)} />
              </div>
              <ShiftMatrixTable columns={monthColumns} rows={matrixRows} metric={metric} />
            </>
          )}
        </>
      )}
    </div>
  )
}
