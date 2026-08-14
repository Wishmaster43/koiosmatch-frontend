/**
 * ReportsPage — thin router for the analytical reports (B-28, RAPPORTEN-OMBOUW-1).
 * The old inner tab bar is GONE (Danny 13-08: every report is its own sub-page,
 * reached from the sidebar's Rapporten submenu). This shell only resolves the
 * active report from the route key handed down by appPages (#reports.<id>) and
 * renders it full-page. The shared period control still travels through the
 * existing `tabsSlot` seam so every report keeps its props and layout unchanged.
 */
import { useId, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import CandidatesReport from './CandidatesReport'
import ApplicationsReport from './ApplicationsReport'
import CustomersReport from './CustomersReport'
import FlowReport from './FlowReport'
import RecruitersReport from './RecruitersReport'
import VacanciesReport from './VacanciesReport'
import OpportunitiesReport from './OpportunitiesReport'
import TasksReport from './TasksReport'
import MatchesReport from './MatchesReport'
import IntakesReport from './IntakesReport'
import OutreachReport from './OutreachReport'
import SourcesReport from './SourcesReport'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { REPORT_IDS } from './reportIds'
import type { ReportId } from './reportIds'
import type { ReportPeriod } from '@/types/analytics'

// Every report takes the same contract: the chosen period + the pass-through slot.
type ReportComponent = ComponentType<{ period: ReportPeriod; tabsSlot?: ReactNode }>

// Registry: report id → component. Ids and their order live in reportIds.ts
// (shared with the sidebar submenu); an id here without a REPORT_IDS entry — or
// vice versa — is a wiring bug the exhaustive Record type surfaces at compile time.
const REPORTS: Record<ReportId, ReportComponent> = {
  candidates:    CandidatesReport,
  applications:  ApplicationsReport,
  customers:     CustomersReport,
  flow:          FlowReport,
  recruiters:    RecruitersReport,
  vacancies:     VacanciesReport,
  opportunities: OpportunitiesReport,
  tasks:         TasksReport,
  matches:       MatchesReport,
  intakes:       IntakesReport,
  outreach:      OutreachReport,
  sources:       SourcesReport,
}

export default function ReportsPage({ reportId }: { reportId?: string }) {
  const { t } = useTranslation('analytics')
  const [period, setPeriod] = useState<ReportPeriod>('month')
  // Names the period picker for the button-based CreatableSelect below (a <button>
  // isn't labelable by htmlFor — see the component's own doc comment).
  const periodLabelId = useId()

  // Resolve the active report; an unknown or absent id (bare #reports) falls
  // back to the FIRST report so a stale deep-link still lands somewhere real.
  const active: ReportId = (REPORT_IDS as readonly string[]).includes(reportId ?? '')
    ? (reportId as ReportId)
    : REPORT_IDS[0]
  const Report = REPORTS[active]

  // Shared period control, top-right. Passed through `tabsSlot` so each report
  // keeps rendering it under its KPI row without any prop change on its side.
  const periodBar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
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
  )

  return (
    <div className="p-6">
      <Report period={period} tabsSlot={periodBar} />
    </div>
  )
}
