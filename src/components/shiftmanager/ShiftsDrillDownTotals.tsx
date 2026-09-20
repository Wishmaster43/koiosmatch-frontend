/**
 * ShiftsDrillDownTotals — the drill-down as grouped TOTALS instead of an order
 * list (Danny, verbatim: "…geen lijsten…totalen…" — i.e. "no lists of orders,
 * only totals — per customer, per function, per location"). Aggregates the
 * shifts behind one month/metric into three per-group tables, switchable
 * between number of shifts and worked hours. The customer name is resolved
 * from the location id via `locationMeta` (the detail
 * rows only carry a customer_external_id).
 */
import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Briefcase, MapPin } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ShiftRow } from '@/types/shiftmanager'
import { captionStyle, SectionTitle } from '@/components/ui/typography'
import { useNumberFormat } from '@/lib/formatters'
import { totalsTableHeaderStyle, totalsTableCellStyle } from './totalsTableStyle'
import SegmentedControl from '@/components/ui/SegmentedControl'

// Per-location display meta (name + owning customer) keyed by location id.
export type LocationMeta = Map<string, { name?: string; customer?: string }>

// Worked hours on a shift = sum of its invites' total_time_worked (0 when nobody worked).
const shiftHours = (s: ShiftRow) => (s.invites ?? []).reduce((sum, inv) => sum + (Number(inv.total_time_worked) || 0), 0)

// Sum a per-shift value per group key (empty/unknown keys fold into one "unknown" bucket).
function groupSum(shifts: ShiftRow[], keyFn: (s: ShiftRow) => string, valFn: (s: ShiftRow) => number, unknown: string) {
  const map = new Map<string, number>()
  for (const s of shifts) {
    const key = keyFn(s).trim() || unknown
    map.set(key, (map.get(key) ?? 0) + valFn(s))
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

// One titled totals table: label · value · share-of-total.
function GroupTable({ icon: Icon, title, rows, total, valueCol, totalRow, fmt, fmtPercent }: {
  icon: LucideIcon; title: string; rows: [string, number][]; total: number; valueCol: string; totalRow: string; fmt: (n: number) => string
  fmtPercent: (ratio: number) => string
}) {
  // Shared header/body cell LAYOUT (D1: was hand-rolled here and in ShiftsBreakdownCharts) —
  // Caption's raw identity (r6 style-object context) plus 600 weight stays local to this table.
  const th: CSSProperties = { ...captionStyle, fontWeight: 600, ...totalsTableHeaderStyle() }
  const td: CSSProperties = totalsTableCellStyle()

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <Icon size={14} color="var(--color-primary)" />
        <SectionTitle as="span">{title}</SectionTitle>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>{title}</th>
            <th style={{ ...th, textAlign: 'right' }}>{valueCol}</th>
            <th style={{ ...th, textAlign: 'right', width: 56 }}>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, n]) => (
            <tr key={label}>
              <td style={{ ...td, textAlign: 'left' }}>{label}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{fmt(n)}</td>
              <td style={{ ...td, textAlign: 'right', color: 'var(--text-muted)' }}>
                {total ? fmtPercent((n / total) * 100) : '—'}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, textAlign: 'left', fontWeight: 700, borderBottom: 'none' }}>{totalRow}</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700, borderBottom: 'none' }}>{fmt(total)}</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700, borderBottom: 'none' }}>{total ? fmtPercent(100) : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Renders three per-group total tables (customer/function/location) instead of a raw shift list, per the totals-only requirement.
export default function ShiftsDrillDownTotals({ shifts, locationMeta }: {
  shifts: ShiftRow[]; locationMeta: LocationMeta
}) {
  const { t } = useTranslation('shiftmanager')
  const { formatNumber, formatPercent } = useNumberFormat()
  const unknown = t('shiftsDrawer.unknown')
  // Switch the aggregated value between number of shifts and worked hours —
  // defaults to hours (Danny: "the drill-down must always show hours").
  const [unit, setUnit] = useState<'count' | 'hours'>('hours')

  // Resolve the location id once per row for the customer/location lookups.
  const locId = (s: ShiftRow) => String(s.order?.customer_location?.id ?? '')
  const valFn = (s: ShiftRow) => unit === 'hours' ? shiftHours(s) : 1

  // Grand total for the selected unit (count or hours), used for the tables' % column and footer row.
  const total = useMemo(() => shifts.reduce((sum, s) => sum + valFn(s), 0), [shifts, unit]) // eslint-disable-line react-hooks/exhaustive-deps
  // Totals per customer, resolving the display name via locationMeta with a raw-id fallback when meta hasn't loaded yet.
  const byCustomer = useMemo(() => groupSum(shifts, (s) =>
    locationMeta.get(locId(s))?.customer ?? String(s.order?.customer_location?.customer_external_id ?? ''), valFn, unknown), [shifts, locationMeta, unknown, unit]) // eslint-disable-line react-hooks/exhaustive-deps
  // Totals per job function/type.
  const byFunction = useMemo(() => groupSum(shifts, (s) => String(s.job_type ?? ''), valFn, unknown), [shifts, unknown, unit]) // eslint-disable-line react-hooks/exhaustive-deps
  // Totals per location, resolving the display name via locationMeta with a raw-name fallback when meta hasn't loaded yet.
  const byLocation = useMemo(() => groupSum(shifts, (s) =>
    locationMeta.get(locId(s))?.name ?? String(s.order?.customer_location?.name ?? ''), valFn, unknown), [shifts, locationMeta, unknown, unit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Shifts as whole numbers, hours with one decimal (active locale).
  const fmt = (n: number) => formatNumber(n, unit === 'hours' ? 1 : undefined)
  const valueCol = unit === 'hours' ? t('shiftsDrawer.byHours') : t('shiftsDrawer.countCol')

  if (shifts.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontSize: 13, color: 'var(--text-muted)' }}>
        {t('shiftsDrawer.empty')}
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      {/* Services / hours switch — the shared compact SegmentedControl (§4 CHIP-TINT-1),
          never a hand-rolled pill button (mirrors ShiftsChartsBlock's own unit toggle). */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <SegmentedControl size="compact" ariaLabel={t('charts.unitToggleLabel')}
          value={unit} onChange={v => setUnit(v as 'count' | 'hours')}
          options={[
            { value: 'count', label: t('shiftsDrawer.countCol') },
            { value: 'hours', label: t('shiftsDrawer.byHours') },
          ]} />
      </div>
      <GroupTable icon={Building2} title={t('shiftsDrawer.byCustomer')} rows={byCustomer} total={total} valueCol={valueCol} totalRow={t('shiftsDrawer.totalRow')} fmt={fmt} fmtPercent={formatPercent} />
      <GroupTable icon={Briefcase} title={t('shiftsDrawer.byFunction')} rows={byFunction} total={total} valueCol={valueCol} totalRow={t('shiftsDrawer.totalRow')} fmt={fmt} fmtPercent={formatPercent} />
      <GroupTable icon={MapPin}    title={t('shiftsDrawer.byLocation')} rows={byLocation} total={total} valueCol={valueCol} totalRow={t('shiftsDrawer.totalRow')} fmt={fmt} fmtPercent={formatPercent} />
    </div>
  )
}
