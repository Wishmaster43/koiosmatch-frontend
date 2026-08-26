/**
 * OccupancyByCustomerBar — planning work-feed tile: fill rate per customer.
 * The server rate is already 0..100, so the chart is plotted with
 * percentValues (never showPercent, which would re-derive a share). A bar
 * with a non-null customer_id (CMBE 0ecd0bf5) drills into the customers page
 * for that record; the no-customer bar stays inert (guarded below, since
 * BarChartCard's onBarClick is chart-wide).
 */
import { useTranslation } from 'react-i18next'
import BarChartCard from '@/components/charts/BarChartCard'
import { Panel } from '@/pages/dashboard/DashboardPrimitives'
import type { OccupancyByCustomerRow } from '@/types/dashboard'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type { FeedTileContext } from '../feedTileKit'

// Fill-rate-per-customer bar; a bar with a known customer id drills into that customer, the no-customer bar stays inert (see file header).
export default function OccupancyByCustomerBar({ rows, onNavigate }: {
  rows: OccupancyByCustomerRow[]
  onNavigate?: FeedTileContext['onNavigate']
}) {
  const { t } = useTranslation('dashboard')
  // customerId travels alongside the chart datum so the click handler can drill.
  // Rows without a known rate are skipped rather than plotted as 0.
  const data = rows
    .filter(r => r.rate != null)
    // The no-customer bucket carries a null id: the tenant label, never the server's Dutch literal.
    .map(r => ({ name: r.customer_id == null ? t('feed.noCustomer') : r.label, value: r.rate as number, customerId: r.customer_id }))

  // Self-hide when no row carries a plottable rate, mirroring FillRateByBranchBar.
  if (!data.length) return null

  // Only a null customer_id (no customer on the order) stays inert; a real
  // customer opens that record.
  const handleBarClick = onNavigate
    ? (d: ChartDatum) => { const customerId = d.customerId as string | null | undefined; if (customerId != null) onNavigate('customers', { open: customerId }) }
    : undefined

  return (
    <Panel>
      <BarChartCard title={t('block.occupancyByCustomer')} data={data} percentValues onBarClick={handleBarClick} />
    </Panel>
  )
}
