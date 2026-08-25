/**
 * OccupancyByCustomerBar — planning work-feed tile: fill rate per customer.
 * The server rate is already 0..100, so the chart is plotted with
 * percentValues (never showPercent, which would re-derive a share). Rows
 * carry only a server label (no customer id), so this tile is INERT
 * (no click) — see OPEN_QUESTIONS for the CMBE ask to add customer_id.
 */
import { useTranslation } from 'react-i18next'
import BarChartCard from '@/components/charts/BarChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import type { OccupancyByCustomerRow } from '@/types/dashboard'

export default function OccupancyByCustomerBar({ rows }: { rows: OccupancyByCustomerRow[] }) {
  const { t } = useTranslation('dashboard')
  // Rows without a known rate are skipped rather than plotted as 0.
  const data = rows.filter(r => r.rate != null).map(r => ({ name: r.label, value: r.rate as number }))

  // Self-hide when no row carries a plottable rate, mirroring FillRateByBranchBar.
  if (!data.length) return null

  return (
    <Panel>
      <BarChartCard title={t('block.occupancyByCustomer')} data={data} percentValues />
    </Panel>
  )
}
