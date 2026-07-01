/**
 * RecruitersReport — per-recruiter productivity (GET /reports/recruiters).
 *
 * One row per recruiter: owned candidates, applications (sum of the per-stage
 * counts, which share the funnel key-map with flow/vacancies), intakes
 * (planned/done), matches, tasks (open/overdue) and the contact-compliance count
 * (> compliance_months). Pure table; data lives in useRecruitersReport.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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

  return (
    <div>
      {/* Tab bar + period control (from the hub) — this report has no KPI strip */}
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
                  <tr key={r.key ?? i}
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
    </div>
  )
}
