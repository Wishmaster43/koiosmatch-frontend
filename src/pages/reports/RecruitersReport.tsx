/**
 * RecruitersReport — per-recruiter productivity (GET /reports/recruiters).
 *
 * One row per recruiter: owned candidates, applications (sum of the per-stage
 * counts, which share the funnel key-map with flow/vacancies), intakes
 * (planned/done), matches, tasks (open/overdue) and the contact-compliance count
 * (> compliance_months). Data lives in useRecruitersReport.
 * Table: shared DataTable (§4 blueprint-conformance — no bespoke table chrome).
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useRecruitersReport } from './useRecruitersReport'
import type { ReportPeriod, RecruiterRow } from '@/types/analytics'

// Total applications = sum of the per-stage counts.
const sumPhases = (r: RecruiterRow) => r.applications_by_phase.reduce((acc, p) => acc + p.count, 0)

// Number cell: emphasised when > 0, muted when zero (mirrors the SM entity tables).
const numCell = (n: number) => (
  <span style={{ fontWeight: n > 0 ? 600 : 400, color: n > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{n}</span>
)

export default function RecruitersReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { data, loading, error } = useRecruitersReport(period)
  const rows   = data?.recruiters ?? []
  const months = data?.compliance_months ?? 6

  // Team totals as KPI blocks (summed across recruiters).
  const sum = (pick: (r: RecruiterRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0)
  const totals = {
    recruiters:   rows.length,
    candidates:   sum(r => r.candidates),
    matches:      sum(r => r.matches),
    notContacted: sum(r => r.not_contacted),
  }

  // Drill-down: clicking a recruiter row (or a total) explains it — the recruiter's
  // candidates + Koios advice.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const openRecruiter = (r: RecruiterRow) => setDrill({
    title: r.label, value: r.candidates, subtitle: t(`period.${period}`),
    breakdown: [
      { label: t('recruiters.cols.candidates'),   value: r.candidates },
      { label: t('recruiters.cols.matches'),      value: r.matches },
      { label: t('recruiters.cols.notContacted'), value: r.not_contacted },
    ],
    entityLabel: t('recruiters.cols.candidates'),
    rowsEndpoint: '/reports/recruiters/drill', rowsParams: { recruiter: r.key, period },
    adviceEndpoint: '/reports/recruiters/advice', adviceParams: { recruiter: r.key, period },
  })

  const kpis: KpiSpec[] = [
    { key: 'recruiters', label: t('recruiters.title'),          value: totals.recruiters },
    { key: 'candidates', label: t('recruiters.cols.candidates'), value: totals.candidates },
    { key: 'matches',    label: t('recruiters.cols.matches'),    value: totals.matches },
    { key: 'notContacted', label: t('recruiters.cols.notContacted'), value: totals.notContacted,
      color: totals.notContacted > 0 ? 'var(--color-warning)' : undefined },
  ]

  // Columns — the two "count · count" text cells stay plain text (no chip meaning to carry).
  const columns: Column<RecruiterRow>[] = [
    { key: 'label',       header: t('recruiters.cols.recruiter'),      sortable: true, sortValue: r => r.label ?? '', render: r => r.label },
    { key: 'candidates',  header: t('recruiters.cols.candidates'),     align: 'right', sortable: true, sortValue: r => r.candidates, render: r => numCell(r.candidates) },
    { key: 'applications',header: t('recruiters.cols.applications'),  align: 'right', sortable: true, sortValue: sumPhases,          render: r => numCell(sumPhases(r)) },
    {
      key: 'intakes', header: t('recruiters.cols.intakes'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      sortable: true, sortValue: r => r.intakes.planned,
      render: r => t('recruiters.intakesValue', { planned: r.intakes.planned, done: r.intakes.done }),
    },
    { key: 'matches', header: t('recruiters.cols.matches'), align: 'right', sortable: true, sortValue: r => r.matches, render: r => numCell(r.matches) },
    {
      key: 'tasks', header: t('recruiters.cols.tasks'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      sortable: true, sortValue: r => r.tasks.open,
      render: r => t('recruiters.tasksValue', { open: r.tasks.open, overdue: r.tasks.overdue }),
    },
    {
      key: 'not_contacted',
      header: <>{t('recruiters.cols.notContacted')} <span style={{ fontWeight: 400, textTransform: 'none' }}>({t('recruiters.notContactedHint', { months })})</span></>,
      align: 'right', sortable: true, sortValue: r => r.not_contacted,
      render: r => <span style={{ color: r.not_contacted > 0 ? 'var(--color-warning)' : 'var(--text)' }}>{r.not_contacted}</span>,
    },
  ]

  return (
    <div>
      {/* KPI strip — team totals, above the tabs (candidate-page order) */}
      {!loading && !error && rows.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {error && !loading ? (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--color-danger)' }}>{t('recruiters.error')}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={r => r.key}
            onRowClick={openRecruiter}
            loading={loading}
            loadingText={t('recruiters.loading')}
            emptyText={t('recruiters.empty')}
          />
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked recruiter + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
