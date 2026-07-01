/**
 * ReportsPage — the analytical reports hub (B-28). A thin shell that owns the
 * sub-tab bar (Flow · Recruiters · later Vacancies) and the shared period control,
 * and renders the active report. Each report owns its own data layer; this only
 * switches tabs and propagates the chosen period.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FlowReport from './FlowReport'
import RecruitersReport from './RecruitersReport'
import VacanciesReport from './VacanciesReport'
import MatchesReport from './MatchesReport'
import type { ReportPeriod } from '@/types/analytics'

export default function ReportsPage({ initialTab = 'flow' }: { initialTab?: string }) {
  const { t } = useTranslation('analytics')
  const [tab,    setTab]    = useState(initialTab)
  const [period, setPeriod] = useState<ReportPeriod>('month')

  // Sub-tabs are config: { id, label }. Add a tab here when its report lands.
  const tabs = [
    { id: 'flow',       label: t('tabs.flow') },
    { id: 'recruiters', label: t('tabs.recruiters') },
    { id: 'vacancies',  label: t('tabs.vacancies') },
    { id: 'matches',    label: t('tabs.matches') },
  ]

  return (
    <div className="p-6">
      {/* Sub-tab bar + shared period control on one row — no page title (the sidebar
          already names the page), so the report's KPI row sits straight at the top,
          consistent with the candidate/entity pages. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(tb => (
            <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: tab === tb.id ? 600 : 400,
                color: tab === tb.id ? 'var(--color-primary)' : 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: tab === tb.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {tb.label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                        color: 'var(--text-muted)', flexShrink: 0, paddingBottom: 6 }}>
          {t('period.label')}
          <select value={period} onChange={e => setPeriod(e.target.value as ReportPeriod)}
            style={{ height: 30, padding: '0 8px', fontSize: 13, border: '1px solid var(--border)',
                     borderRadius: 8, color: 'var(--text)', background: 'var(--surface)', cursor: 'pointer' }}>
            <option value="day">{t('period.day')}</option>
            <option value="week">{t('period.week')}</option>
            <option value="month">{t('period.month')}</option>
          </select>
        </label>
      </div>

      {tab === 'flow'       && <FlowReport period={period} />}
      {tab === 'recruiters' && <RecruitersReport period={period} />}
      {tab === 'vacancies'  && <VacanciesReport period={period} />}
      {tab === 'matches'    && <MatchesReport period={period} />}
    </div>
  )
}
