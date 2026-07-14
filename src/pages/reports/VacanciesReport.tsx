/**
 * VacanciesReport — per-vacancy demand + fill metrics (GET /reports/vacancies).
 *
 * A summary tile row (total · open · filled · fill-rate · avg time-to-fill) over a
 * table of vacancies (status · applications · matched · filled · time-to-fill).
 * fill-rate/time-to-fill are server-derived; `time_to_fill_days` is null while
 * open. applications_by_phase shares the funnel key-map. Data lives in the hook.
 * Table: shared DataTable (§4 blueprint-conformance — no bespoke table chrome).
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import SoftChip from '@/components/ui/SoftChip'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useVacanciesReport } from './useVacanciesReport'
import type { ReportPeriod, VacancyReportRow } from '@/types/analytics'

// Number cell: emphasised when > 0, muted when zero (mirrors the SM entity tables).
const numCell = (n: number) => (
  <span style={{ fontWeight: n > 0 ? 600 : 400, color: n > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{n}</span>
)

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
  const openVacancyRow = (v: VacancyReportRow) => setDrill({
    title: v.label, value: v.applications, subtitle: v.customer?.name ?? t(`period.${period}`),
    breakdown: [
      { label: t('vacancies.cols.applications'), value: v.applications },
      { label: t('vacancies.cols.matched'),      value: v.matched },
    ],
    rowsEndpoint: '/reports/vacancies/drill', rowsParams: { vacancy: v.key, period },
    adviceEndpoint: '/reports/vacancies/advice', adviceParams: { vacancy: v.key, period },
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
      {!loading && !error && rows.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* Table — shared DataTable handles loading/empty; error stays a dedicated banner */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {error && !loading ? (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--color-danger)' }}>{t('vacancies.error')}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={v => v.key}
            onRowClick={openVacancyRow}
            loading={loading}
            loadingText={t('vacancies.loading')}
            emptyText={t('vacancies.empty')}
          />
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked number + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
