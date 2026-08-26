/**
 * DistributionCharts — the dashboard's distribution grid: candidates by status,
 * funnel stage counts, candidates by recruiter, and opportunities by stage (or an
 * intake-over-time fallback while /opportunities/stats is unavailable). Self-hides
 * when every chart in the group is switched off for the active role. Extracted from
 * Dashboard.tsx (§0.3 size split); rendering identical to the original inline grid.
 */
import { useTranslation } from 'react-i18next'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { Panel } from '../DashboardPrimitives'
import CalloutBox from '@/components/ui/CalloutBox'
import { fv } from '../dashboardFormat'
import type { DashOpp } from '@/types/dashboard'
import type { DashboardViewModel } from '../hooks/useDashboardViewModel'

// Dashboard's distribution-chart group (status/funnel/recruiter/opportunity-stage);
// see the module doc comment above for the role-visibility/empty-group behaviour.
export default function DistributionCharts({ vis, statusData, funnelData, recruiterData, oppStageData, opp, onNavigate }: {
  vis: DashboardViewModel['vis']
  statusData: DashboardViewModel['statusData']
  funnelData: DashboardViewModel['funnelData']
  recruiterData: DashboardViewModel['recruiterData']
  oppStageData: DashboardViewModel['oppStageData']
  opp: DashOpp | null
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  if (!(vis('chart.status') || vis('chart.recruiter') || vis('chart.funnel') || vis('chart.oppStage'))) return null

  return (
    // Distribution charts — one auto-flow 2-column grid; hidden charts drop out so the
    // visible ones (e.g. status + funnel for recruitment) naturally line up side by side.
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
      {vis('chart.status') && <Panel><PieChartCard title={t('chart.byStatus')} data={statusData} colors={statusData.map(d => d.color) as string[]} onItemClick={(d) => onNavigate?.('candidates', fv(d) ? { status: fv(d) } : undefined)} /></Panel>}
      {vis('chart.funnel') && <Panel><BarChartCard title={t('chart.funnel')} data={funnelData} colors={funnelData.map(d => d.color) as string[]} showAverage onBarClick={(d) => onNavigate?.('applications', fv(d) ? { stage: fv(d) } : undefined)} /></Panel>}
      {vis('chart.recruiter') && <Panel><PieChartCard title={t('chart.byRecruiter')} data={recruiterData} onItemClick={(d) => onNavigate?.('candidates', fv(d) ? { owner: fv(d) } : undefined)} /></Panel>}
      {vis('chart.oppStage') && <Panel>
        {opp
          ? <PieChartCard title={t('chart.byStage')} data={oppStageData} colors={oppStageData.map(d => d.color) as string[]} onItemClick={(d) => onNavigate?.('opportunities', fv(d) ? { stage: fv(d) } : undefined)} />
          // Honest "not available" notice — no titled chart faking an empty data series
          // while /opportunities/stats is unavailable.
          : <CalloutBox variant="info">{t('chart.oppStageUnavailable')}</CalloutBox>}
      </Panel>}
    </div>
  )
}
