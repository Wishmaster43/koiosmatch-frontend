/**
 * VacanciesReport — per-vacancy demand + fill metrics (GET /reports/vacancies).
 *
 * A summary tile row (total · open · filled · fill-rate · avg time-to-fill) over a
 * table of vacancies (status · applications · matched · filled · time-to-fill).
 * fill-rate/time-to-fill are server-derived; `time_to_fill_days` is null while
 * open. applications_by_phase shares the funnel key-map. Data lives in the hook.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useVacanciesReport } from './useVacanciesReport'
import type { ReportPeriod } from '@/types/analytics'

const TH: CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
}
const TD: CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text)',
  borderBottom: '1px solid var(--hover-bg)', whiteSpace: 'nowrap' }
const NUM: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }

// Soft chip — coloured background/text, never a solid fill (soft-chip convention).
function Chip({ label, tone }: { label: string; tone: 'success' | 'muted' }) {
  const color = tone === 'success' ? 'var(--color-success)' : 'var(--text-muted)'
  const bg    = tone === 'success' ? 'var(--color-success-bg)' : 'var(--hover-bg)'
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 500,
                   padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{label}</span>
  )
}

export default function VacanciesReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { data, loading, error } = useVacanciesReport(period)
  const rows = data?.vacancies ?? []
  const s    = data?.summary

  // Drill-down: clicking a vacancies KPI explains it (open/filled split + the
  // vacancies behind it + Koios advice). Status filter goes to the drill endpoint.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const openVacancies = (title: string, value: number | string, status?: string) => setDrill({
    title, value, subtitle: t(`period.${period}`),
    breakdown: [
      { label: t('vacancies.summary.open'),   value: s?.open ?? 0 },
      { label: t('vacancies.summary.filled'), value: s?.filled ?? 0 },
    ],
    rowsEndpoint: '/reports/vacancies/drill', rowsParams: { status, period },
    adviceEndpoint: '/reports/vacancies/advice', adviceParams: { status, period },
  })

  const kpis: KpiSpec[] = [
    { key: 'total',  label: t('vacancies.summary.total'),  value: s?.total ?? 0,
      active: drill != null && drill.rowsParams?.status == null,
      onClick: () => openVacancies(t('vacancies.summary.total'), s?.total ?? 0) },
    { key: 'open',   label: t('vacancies.summary.open'),   value: s?.open ?? 0,
      active: drill?.rowsParams?.status === 'open',
      onClick: () => openVacancies(t('vacancies.summary.open'), s?.open ?? 0, 'open') },
    { key: 'filled', label: t('vacancies.summary.filled'), value: s?.filled ?? 0,
      active: drill?.rowsParams?.status === 'filled',
      onClick: () => openVacancies(t('vacancies.summary.filled'), s?.filled ?? 0, 'filled') },
    { key: 'fillRate', label: t('vacancies.summary.fillRate'),
      value: s ? `${Math.round(s.fill_rate * 100)}%` : '—' },
    { key: 'ttf', label: t('vacancies.summary.avgTimeToFill'),
      value: s?.avg_time_to_fill_days != null ? t('vacancies.daysValue', { days: Math.round(s.avg_time_to_fill_days) }) : '—' },
  ]

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order: KPIs first) */}
      {!loading && !error && rows.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* Table — four UI states */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>{t('vacancies.loading')}</div>
        )}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--color-danger)' }}>{t('vacancies.error')}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>{t('vacancies.empty')}</div>
        )}
        {!loading && !error && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>{t('vacancies.cols.vacancy')}</th>
                  <th style={TH}>{t('vacancies.cols.customer')}</th>
                  <th style={TH}>{t('vacancies.cols.status')}</th>
                  <th style={{ ...TH, textAlign: 'right' }}>{t('vacancies.cols.applications')}</th>
                  <th style={{ ...TH, textAlign: 'right' }}>{t('vacancies.cols.matched')}</th>
                  <th style={TH}>{t('vacancies.cols.filled')}</th>
                  <th style={{ ...TH, textAlign: 'right' }}>{t('vacancies.cols.timeToFill')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v, i) => (
                  <tr key={v.key ?? i} style={{ cursor: 'pointer' }}
                    onClick={() => setDrill({
                      title: v.label, value: v.applications, subtitle: v.customer?.name ?? t(`period.${period}`),
                      breakdown: [
                        { label: t('vacancies.cols.applications'), value: v.applications },
                        { label: t('vacancies.cols.matched'),      value: v.matched },
                      ],
                      rowsEndpoint: '/reports/vacancies/drill', rowsParams: { vacancy: v.key, period },
                      adviceEndpoint: '/reports/vacancies/advice', adviceParams: { vacancy: v.key, period },
                    })}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, fontWeight: 500 }}>
                      {v.label}
                      {v.code && <span style={{ marginLeft: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{v.code}</span>}
                    </td>
                    <td style={{ ...TD, color: 'var(--text-muted)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.customer?.name ?? '—'}
                    </td>
                    <td style={TD}>{v.status?.label ? <Chip label={v.status.label} tone="muted" /> : '—'}</td>
                    <td style={NUM}>{v.applications}</td>
                    <td style={NUM}>{v.matched}</td>
                    <td style={TD}>
                      <Chip label={v.filled ? t('vacancies.filledYes') : t('vacancies.filledNo')} tone={v.filled ? 'success' : 'muted'} />
                    </td>
                    <td style={{ ...NUM, fontWeight: 500 }}>
                      {v.time_to_fill_days != null ? t('vacancies.daysValue', { days: v.time_to_fill_days }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked number + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
