/**
 * PeopleReport — "Mensen": Recruiters/Accountmanagers share one switch page
 * (RAPPORTEN-CONSOLIDATIE-1, Danny's sidebar-shortening ask: "beide beantwoorden
 * 'hoe doen mijn mensen het', tegen een andere entiteit"). Recruiters is productivity
 * against the CANDIDATE book, Accountmanagers is ownership against the CUSTOMER
 * book — two different entities/endpoints under one "how is my team doing" switch,
 * so this page swaps which full report component renders (no shared filter/hook —
 * unlike Instroom's Kandidaten/Leads or Klanten's Klanten/Prospects, there is no
 * single population a `phase` filter could narrow between these two). Each position
 * is the EXACT pre-existing report component, unchanged — its own nine KPI cards
 * (independently configurable in Settings, see kpiCatalog.ts), its own table, its
 * own drill behaviour.
 */
import { useTranslation } from 'react-i18next'
import ReportSwitchBar from './ReportSwitchBar'
import { useReportSwitch } from './useReportSwitch'
import RecruitersReport from './RecruitersReport'
import AccountManagersReport from './AccountManagersReport'
import type { ReportPeriod } from '@/types/analytics'

// Kept as plain `string` on the wire (see CandidatesReport's identical note) so
// this component satisfies ReportsPage's one shared `ReportComponent` contract.
const VIEWS = ['recruiters', 'accountmanagers'] as const

export default function PeopleReport({ period, initialView = 'recruiters' }: {
  period: ReportPeriod
  initialView?: string
}) {
  const { t } = useTranslation('analytics')
  const [view, setView] = useReportSwitch(VIEWS, initialView)

  return (
    <div>
      <ReportSwitchBar ariaLabel={t('people.viewSwitch.ariaLabel')} value={view} onChange={setView}
        options={[
          { value: 'recruiters', label: t('people.viewSwitch.recruiters') },
          { value: 'accountmanagers', label: t('people.viewSwitch.accountmanagers') },
        ]} />
      {view === 'recruiters' && <RecruitersReport period={period} />}
      {view === 'accountmanagers' && <AccountManagersReport period={period} />}
    </div>
  )
}
