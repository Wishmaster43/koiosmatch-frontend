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
import ReportKpiBand from './ReportKpiBand'
import ReportStateBlock from './ReportStateBlock'
import { ReportSectionCard } from './ReportSectionCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useRecruitersReport } from './useRecruitersReport'
import { gateDrillClick } from './reportDrillGate'
import type { ReportPeriod, RecruiterRow } from '@/types/analytics'

// Total applications = sum of the per-stage counts.
const sumPhases = (r: RecruiterRow) => r.applications_by_phase.reduce((acc, p) => acc + p.count, 0)

// Number cell: emphasised when > 0, muted when zero (mirrors the SM entity tables).
const numCell = (n: number) => (
  <span style={{ fontWeight: n > 0 ? 600 : 400, color: n > 0 ? 'var(--text)' : 'var(--text-muted)' }}>{n}</span>
)

export default function RecruitersReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { data, loading, error, refetch } = useRecruitersReport(period)
  const rows   = data?.recruiters ?? []
  const months = data?.compliance_months ?? 6

  // Team totals as KPI blocks (summed across recruiters).
  const sum = (pick: (r: RecruiterRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0)
  const totals = {
    recruiters:   rows.length,
    candidates:   sum(r => r.candidates),
    applications: sum(sumPhases),
    matches:      sum(r => r.matches),
    notContacted: sum(r => r.not_contacted),
    intakesPlanned: sum(r => r.intakes.planned),
    intakesDone:    sum(r => r.intakes.done),
    tasksOpen:      sum(r => r.tasks.open),
    tasksOverdue:   sum(r => r.tasks.overdue),
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

  // Team totals — all nine slots are plain sums of fields the endpoint already
  // returns per recruiter (no per-team drill endpoint exists, so none is clickable;
  // the row click into a single recruiter stays the drill path, unchanged).
  const kpis: KpiSpec[] = [
    { key: 'recruiters', label: t('recruiters.summary.recruiters'),   value: totals.recruiters },
    { key: 'candidates', label: t('recruiters.summary.candidates'),   value: totals.candidates },
    { key: 'applications', label: t('recruiters.summary.applications'), value: totals.applications },
    { key: 'matches',    label: t('recruiters.summary.matches'),      value: totals.matches },
    { key: 'notContacted', label: t('recruiters.summary.notContacted'), value: totals.notContacted,
      color: totals.notContacted > 0 ? 'var(--color-warning)' : undefined },
    { key: 'intakesPlanned', label: t('recruiters.summary.intakesPlanned'), value: totals.intakesPlanned },
    { key: 'intakesDone',    label: t('recruiters.summary.intakesDone'),    value: totals.intakesDone },
    { key: 'tasksOpen',      label: t('recruiters.summary.tasksOpen'),      value: totals.tasksOpen },
    { key: 'tasksOverdue',   label: t('recruiters.summary.tasksOverdue'),   value: totals.tasksOverdue,
      color: totals.tasksOverdue > 0 ? 'var(--color-warning)' : undefined },
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
        <ReportKpiBand kpis={kpis} />
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      <ReportSectionCard>
        {error && !loading ? (
          <ReportStateBlock
            loading={false} error empty={false}
            loadingLabel={t('recruiters.loading')} errorLabel={t('recruiters.error')} emptyLabel={t('recruiters.empty')}
            onRetry={() => refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={r => r.key}
            onRowClick={gateDrillClick('recruiters', openRecruiter)}
            loading={loading}
            loadingText={t('recruiters.loading')}
            emptyText={t('recruiters.empty')}
          />
        )}
      </ReportSectionCard>

      {/* Dynamic drill-down: explains the clicked recruiter + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
