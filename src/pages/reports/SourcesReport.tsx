/**
 * SourcesReport — candidate-source ROI (GET /reports/sources, REPORTS-2 fase 2): per
 * source, the intake cohort, its applications and its placements + placement rate, so
 * a bureau sees which channels actually convert. Table via the shared DataTable (§4
 * blueprint-conformance — no bespoke table chrome). No drill-down: the
 * /reports/sources/drill endpoint doesn't exist (reportDrillGate) and a source row
 * has no further single-record breakdown to explain.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import { useSourcesReport } from './useSourcesReport'
import type { ReportPeriod, SourceRow } from '@/types/analytics'

// Number cell: emphasised when > 0, muted when zero (mirrors the SM entity tables).
const numCell = (n: number) => (
  <span style={{ fontWeight: n > 0 ? 600 : 400, color: n > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{n}</span>
)

export default function SourcesReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  // `period` is accepted for call-signature parity with the other reports but this
  // endpoint has no bucket — see the hook's own doc comment.
  const { data, loading, error } = useSourcesReport(period)
  const rows = data?.sources ?? []

  const totals = {
    candidates:   rows.reduce((acc, r) => acc + r.candidates, 0),
    applications: rows.reduce((acc, r) => acc + r.applications, 0),
    matches:      rows.reduce((acc, r) => acc + r.matches, 0),
  }

  const kpis: KpiSpec[] = [
    { key: 'sources',      label: t('sources.summary.sources'),      value: rows.length },
    { key: 'candidates',   label: t('sources.summary.candidates'),   value: totals.candidates },
    { key: 'applications', label: t('sources.summary.applications'), value: totals.applications },
    { key: 'matches',      label: t('sources.summary.matches'),      value: totals.matches },
  ]

  const columns: Column<SourceRow>[] = [
    { key: 'source',       header: t('sources.cols.source'),       sortable: true, sortValue: r => r.source ?? '', render: r => r.source },
    { key: 'candidates',   header: t('sources.cols.candidates'),   align: 'right', sortable: true, sortValue: r => r.candidates,   render: r => numCell(r.candidates) },
    { key: 'applications', header: t('sources.cols.applications'), align: 'right', sortable: true, sortValue: r => r.applications, render: r => numCell(r.applications) },
    { key: 'matches',      header: t('sources.cols.matches'),      align: 'right', sortable: true, sortValue: r => r.matches,      render: r => numCell(r.matches) },
    {
      key: 'match_rate', header: t('sources.cols.matchRate'), align: 'right', sortable: true,
      sortValue: r => r.match_rate ?? -1,
      render: r => r.match_rate != null ? `${Math.round(r.match_rate * 100)}%` : '—',
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
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--color-danger)' }}>{t('sources.error')}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={r => r.source}
            loading={loading}
            loadingText={t('sources.loading')}
            emptyText={t('sources.empty')}
          />
        )}
      </div>
    </div>
  )
}
