/**
 * RecruitersReport — per-recruiter productivity (GET /reports/recruiters).
 *
 * One row per recruiter: owned candidates, applications (sum of the per-stage
 * counts, which share the funnel key-map with flow/vacancies), intakes
 * (planned/done), matches, tasks (open/overdue) and the contact-compliance count
 * (> compliance_months). Pure table; data lives in useRecruitersReport.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useRecruitersReport } from './useRecruitersReport'
import type { ReportPeriod, RecruiterRow } from '@/types/analytics'

const TH: CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
}
const TD: CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text)',
  borderBottom: '1px solid var(--hover-bg)', whiteSpace: 'nowrap' }
const NUM: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }

// Total applications = sum of the per-stage counts.
const sumPhases = (r: RecruiterRow) => r.applications_by_phase.reduce((acc, p) => acc + p.count, 0)

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
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>{t('recruiters.loading')}</div>
        )}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--color-danger)' }}>{t('recruiters.error')}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>{t('recruiters.empty')}</div>
        )}
        {!loading && !error && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>{t('recruiters.cols.recruiter')}</th>
                  <th style={{ ...TH, textAlign: 'right' }}>{t('recruiters.cols.candidates')}</th>
                  <th style={{ ...TH, textAlign: 'right' }}>{t('recruiters.cols.applications')}</th>
                  <th style={TH}>{t('recruiters.cols.intakes')}</th>
                  <th style={{ ...TH, textAlign: 'right' }}>{t('recruiters.cols.matches')}</th>
                  <th style={TH}>{t('recruiters.cols.tasks')}</th>
                  <th style={{ ...TH, textAlign: 'right' }}>
                    {t('recruiters.cols.notContacted')} <span style={{ fontWeight: 400, textTransform: 'none' }}>({t('recruiters.notContactedHint', { months })})</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key ?? i} style={{ cursor: 'pointer' }} onClick={() => openRecruiter(r)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, fontWeight: 500 }}>{r.label}</td>
                    <td style={NUM}>{r.candidates}</td>
                    <td style={NUM}>{sumPhases(r)}</td>
                    <td style={{ ...TD, color: 'var(--text-muted)', fontSize: 12 }}>
                      {t('recruiters.intakesValue', { planned: r.intakes.planned, done: r.intakes.done })}
                    </td>
                    <td style={NUM}>{r.matches}</td>
                    <td style={{ ...TD, color: 'var(--text-muted)', fontSize: 12 }}>
                      {t('recruiters.tasksValue', { open: r.tasks.open, overdue: r.tasks.overdue })}
                    </td>
                    <td style={{ ...NUM, color: r.not_contacted > 0 ? 'var(--color-warning)' : 'var(--text)' }}>
                      {r.not_contacted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked recruiter + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
