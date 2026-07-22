/**
 * TrendsRow — the weekly inflow trend (grouped bar: candidates/applications/matches
 * + outflow/net) beside the funnel-conversion block, side by side when both are
 * visible for the role, full width otherwise. Extracted from Dashboard.tsx (§0.3
 * size split); the bucket→navigation mapping in onBarClick is unchanged.
 */
import { useTranslation } from 'react-i18next'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import { Panel } from '../DashboardPrimitives'
import FunnelConversion from './FunnelConversion'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type { TrendRow as TrendRowData } from '@/types/dashboard'
import type { DashboardViewModel } from '../hooks/useDashboardViewModel'

export default function TrendsRow({ vis, trendData, trendSeries, funnelData, onNavigate }: {
  vis: DashboardViewModel['vis']
  trendData: DashboardViewModel['trendData']
  trendSeries: DashboardViewModel['trendSeries']
  funnelData: DashboardViewModel['funnelData']
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}) {
  const { t } = useTranslation('dashboard')
  if (!(vis('chart.weekly') || vis('chart.funnelConversion'))) return null

  return (
    // Instroom (per week) + Funnel-conversie side by side (Danny 2026-07-15):
    // equal-width row when both are visible, full-width for whichever remains
    // when the other is switched off for this role.
    <div style={{ display: 'grid',
      gridTemplateColumns: (vis('chart.weekly') && vis('chart.funnelConversion')) ? '1fr 1fr' : '1fr',
      gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
      {vis('chart.weekly') && (
      <Panel>
        <WeeklyBarChartCard title={t('chart.intakeWeekly')} data={trendData as unknown as ChartDatum[]} series={trendSeries}
          onBarClick={(row, s) => {
            const r = row as TrendRowData & { __from?: string; __to?: string; __date?: string }
            const name = r?.name
            const page = s.key === 'sollicitaties' ? 'applications' : (s.key === 'matches' || s.key === 'uitBeeindigd') ? 'matches' : 'candidates'
            // Turn the clicked bucket into a created-date range when it carries boundaries
            // (explicit from/to, or an ISO-date name treated as a 7-day week).
            const iso = typeof name === 'string' && /^\d{4}-\d{2}-\d{2}/.test(name) ? name.slice(0, 10) : undefined
            const from = r?.__from ?? r?.__date ?? iso
            let to = r?.__to
            if (!to && from) { const d = new Date(from); d.setDate(d.getDate() + 6); to = d.toISOString().slice(0, 10) }
            if (page === 'candidates' && from && to) { onNavigate?.('candidates', { created_between: [from, to] }); return }
            onNavigate?.(page, name ? { period: name } : undefined)
          }} />
      </Panel>
      )}
      {/* Funnel-conversie — % doorstroom per fase (FE-derived); klik → sollicitaties op fase. */}
      {vis('chart.funnelConversion') && (
        <FunnelConversion data={funnelData} onStageClick={(fv) => onNavigate?.('applications', fv ? { stage: fv } : undefined)} />
      )}
    </div>
  )
}
