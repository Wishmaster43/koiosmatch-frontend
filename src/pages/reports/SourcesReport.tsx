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
import ReportKpiBand from './ReportKpiBand'
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
  // Overall match rate = totalMatches / totalCandidates (mirrors the per-row
  // match_rate the endpoint computes); '—' rather than a fabricated 0% at zero.
  const overallMatchRate = totals.candidates > 0 ? Math.round((totals.matches / totals.candidates) * 100) : null
  // Applications per candidate = totalApplications / totalCandidates — a second real ratio.
  const applicationRate = totals.candidates > 0 ? Math.round((totals.applications / totals.candidates) * 100) : null
  // "Biggest" sources by each real metric — plain stats, no drill endpoint exists
  // (see file doc comment) so none of the nine cards is clickable.
  const topByCandidates = [...rows].sort((a, b) => b.candidates - a.candidates)[0]
  const topByMatches = [...rows].sort((a, b) => b.matches - a.matches)[0]
  const sourcesNoMatches = rows.filter(r => r.matches === 0).length

  const kpis: KpiSpec[] = [
    { key: 'sources',      label: t('sources.summary.sources'),      value: rows.length },
    { key: 'candidates',   label: t('sources.summary.candidates'),   value: totals.candidates },
    { key: 'applications', label: t('sources.summary.applications'), value: totals.applications },
    { key: 'matches',      label: t('sources.summary.matches'),      value: totals.matches },
    { key: 'matchRate',    label: t('sources.summary.matchRate'),    value: overallMatchRate != null ? `${overallMatchRate}%` : '—' },
    { key: 'applicationRate', label: t('sources.summary.applicationRate'), value: applicationRate != null ? `${applicationRate}%` : '—' },
    { key: 'topSourceCandidates', label: t('sources.summary.topSourceCandidates'),
      value: topByCandidates ? `${topByCandidates.source} · ${topByCandidates.candidates}` : '—' },
    { key: 'topSourceMatches', label: t('sources.summary.topSourceMatches'),
      value: topByMatches && topByMatches.matches > 0 ? `${topByMatches.source} · ${topByMatches.matches}` : '—' },
    { key: 'sourcesNoMatches', label: t('sources.summary.sourcesNoMatches'), value: sourcesNoMatches,
      color: sourcesNoMatches > 0 ? 'var(--color-warning)' : undefined },
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
        <ReportKpiBand kpis={kpis} />
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
