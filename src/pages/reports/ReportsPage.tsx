/**
 * ReportsPage — the analytical reports hub (B-28). A thin shell that owns the
 * sub-tab bar (Flow · Recruiters · later Vacancies) and the shared period control,
 * and renders the active report. Each report owns its own data layer; this only
 * switches tabs and propagates the chosen period.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CandidatesReport from './CandidatesReport'
import ApplicationsReport from './ApplicationsReport'
import FlowReport from './FlowReport'
import RecruitersReport from './RecruitersReport'
import VacanciesReport from './VacanciesReport'
import MatchesReport from './MatchesReport'
import IntakesReport from './IntakesReport'
import OutreachReport from './OutreachReport'
import SourcesReport from './SourcesReport'
import CreatableSelect from '@/components/ui/CreatableSelect'
import type { ReportPeriod } from '@/types/analytics'

export default function ReportsPage({ initialTab = 'candidates' }: { initialTab?: string }) {
  const { t } = useTranslation('analytics')
  const [tab,    setTab]    = useState(initialTab)
  const [period, setPeriod] = useState<ReportPeriod>('month')
  // Names the period picker for the button-based CreatableSelect below (a <button>
  // isn't labelable by htmlFor — see the component's own doc comment).
  const periodLabelId = useId()

  // Sub-tabs are config: { id, label }. Add a tab here when its report lands.
  // Candidates/leads INFLOW sits first — Danny's morning first-look (RAPPORTEN-SUITE-1).
  const tabs = [
    { id: 'candidates',  label: t('tabs.candidates') },
    { id: 'applications', label: t('tabs.applications') },
    { id: 'flow',       label: t('tabs.flow') },
    { id: 'recruiters', label: t('tabs.recruiters') },
    { id: 'vacancies',  label: t('tabs.vacancies') },
    { id: 'matches',    label: t('tabs.matches') },
    { id: 'intakes',    label: t('tabs.intakes') },
    { id: 'outreach',   label: t('tabs.outreach') },
    { id: 'sources',    label: t('tabs.sources') },
  ]

  // Tab bar + shared period control on one row. Passed to each report as `tabsSlot`
  // so the report renders its KPI row ABOVE the tabs — same order as the candidate
  // page (KPIs first, then navigation), consistent across every report.
  const tabsBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {tabs.map(tb => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: tab === tb.id ? 600 : 400,
              // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
              color: tab === tb.id ? 'var(--color-primary-text)' : 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === tb.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {tb.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                    color: 'var(--text-muted)', flexShrink: 0, paddingBottom: 6 }}>
        <span id={periodLabelId}>{t('period.label')}</span>
        {/* Searchable combobox replaces the bare native <select> (Danny 08-08, §4) —
            allowCreate=false since the period is a fixed, non-creatable vocabulary. */}
        <CreatableSelect
          aria-labelledby={periodLabelId}
          value={period}
          onChange={v => setPeriod(v as ReportPeriod)}
          allowCreate={false}
          menuWidth={140}
          options={[
            { value: 'day', label: t('period.day') },
            { value: 'week', label: t('period.week') },
            { value: 'month', label: t('period.month') },
          ]}
          style={{ height: 30, padding: '0 8px', fontSize: 13 }}
        />
      </div>
    </div>
  )

  return (
    <div className="p-6">
      {tab === 'candidates'  && <CandidatesReport  period={period} tabsSlot={tabsBar} />}
      {tab === 'applications' && <ApplicationsReport period={period} tabsSlot={tabsBar} />}
      {tab === 'flow'       && <FlowReport       period={period} tabsSlot={tabsBar} />}
      {tab === 'recruiters' && <RecruitersReport period={period} tabsSlot={tabsBar} />}
      {tab === 'vacancies'  && <VacanciesReport  period={period} tabsSlot={tabsBar} />}
      {tab === 'matches'    && <MatchesReport    period={period} tabsSlot={tabsBar} />}
      {tab === 'intakes'    && <IntakesReport    period={period} tabsSlot={tabsBar} />}
      {tab === 'outreach'   && <OutreachReport   period={period} tabsSlot={tabsBar} />}
      {tab === 'sources'    && <SourcesReport    period={period} tabsSlot={tabsBar} />}
    </div>
  )
}
