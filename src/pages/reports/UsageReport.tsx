/**
 * UsageReport — "Verbruik": AI usage/Workflow runs share one switch page
 * (RAPPORTEN-CONSOLIDATIE-1, Danny's sidebar-shortening ask). Two different
 * consumption entities (Koios AI activity lines vs. automation runs) under one
 * "system usage" switch, so this page swaps which full report component renders.
 * Each position is the EXACT pre-existing report component, unchanged — its own
 * nine KPI cards (independently configurable in Settings, see kpiCatalog.ts), its
 * own axes/drill behaviour (AI's bars stay non-clickable, workflows' don't — each
 * report keeps its own drill-availability contract, see reportDrillGate.ts).
 */
import { useTranslation } from 'react-i18next'
import ReportSwitchBar from './ReportSwitchBar'
import { useReportSwitch } from './useReportSwitch'
import AiReport from './AiReport'
import WorkflowsReport from './WorkflowsReport'
import type { ReportPeriod } from '@/types/analytics'

// Kept as plain `string` on the wire (see CandidatesReport's identical note) so
// this component satisfies ReportsPage's one shared `ReportComponent` contract.
const VIEWS = ['ai', 'workflows'] as const

export default function UsageReport({ period, initialView = 'ai' }: {
  period: ReportPeriod
  initialView?: string
}) {
  const { t } = useTranslation('analytics')
  const [view, setView] = useReportSwitch(VIEWS, initialView)

  return (
    <div>
      <ReportSwitchBar ariaLabel={t('usage.viewSwitch.ariaLabel')} value={view} onChange={setView}
        options={[
          { value: 'ai', label: t('usage.viewSwitch.ai') },
          { value: 'workflows', label: t('usage.viewSwitch.workflows') },
        ]} />
      {view === 'ai' && <AiReport period={period} />}
      {view === 'workflows' && <WorkflowsReport period={period} />}
    </div>
  )
}
