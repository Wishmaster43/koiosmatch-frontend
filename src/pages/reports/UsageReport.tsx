/**
 * UsageReport — "Verbruik": the whole-bill overview plus its two halves share one
 * switch page (RAPPORTEN-CONSOLIDATIE-1, Danny's sidebar-shortening ask). This
 * page only swaps which full report component renders.
 *
 * "Totaal" leads, because a bureau receives ONE invoice and needs one screen that
 * explains it (GET /reports/usage merges both sources). AI and Workflows follow as
 * the deep dives and are the EXACT pre-existing components, unchanged. Every
 * position keeps its own nine KPI cards (independently configurable in Settings,
 * see kpiCatalog.ts) and its own drill-availability contract — AI's bars stay
 * non-clickable, workflows' do not, and the overview's wait for their own endpoint
 * pair (reportDrillGate.ts). A switch position is a full report, never a lesser view.
 */
import { useTranslation } from 'react-i18next'
import ReportSwitchBar from './ReportSwitchBar'
import { useReportSwitch } from './useReportSwitch'
import UsageOverviewReport from './UsageOverviewReport'
import AiReport from './AiReport'
import WorkflowsReport from './WorkflowsReport'
import type { ReportPeriod } from '@/types/analytics'

// Kept as plain `string` on the wire (see CandidatesReport's identical note) so
// this component satisfies ReportsPage's one shared `ReportComponent` contract.
const VIEWS = ['total', 'ai', 'workflows'] as const

export default function UsageReport({ period, initialView = 'total' }: {
  period: ReportPeriod
  initialView?: string
}) {
  const { t } = useTranslation('analytics')
  const [view, setView] = useReportSwitch(VIEWS, initialView)

  return (
    <div>
      <ReportSwitchBar ariaLabel={t('usage.viewSwitch.ariaLabel')} value={view} onChange={setView}
        options={[
          { value: 'total', label: t('usage.viewSwitch.total') },
          { value: 'ai', label: t('usage.viewSwitch.ai') },
          { value: 'workflows', label: t('usage.viewSwitch.workflows') },
        ]} />
      {view === 'total' && <UsageOverviewReport period={period} />}
      {view === 'ai' && <AiReport period={period} />}
      {view === 'workflows' && <WorkflowsReport period={period} />}
    </div>
  )
}
