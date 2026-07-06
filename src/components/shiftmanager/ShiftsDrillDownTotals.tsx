/**
 * ShiftsDrillDownTotals — the drill-down as grouped TOTALS instead of an order
 * list (Danny: "geen lijsten van orders maar totalen — per klant, per functie,
 * per locatie"). Aggregates the shifts behind one month/metric into three
 * count-per-group tables. The customer name is resolved from the location id via
 * `locationMeta` (the detail rows only carry a customer_external_id).
 */
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Briefcase, MapPin } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ShiftRow } from '@/types/shiftmanager'

// Per-location display meta (name + owning customer) keyed by location id.
export type LocationMeta = Map<string, { name?: string; customer?: string }>

// Count shifts per group key (empty/unknown keys fold into one "unknown" bucket).
function groupCounts(shifts: ShiftRow[], keyFn: (s: ShiftRow) => string, unknown: string) {
  const map = new Map<string, number>()
  for (const s of shifts) {
    const key = keyFn(s).trim() || unknown
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

// One titled totals table: label · count · share-of-total.
function GroupTable({ icon: Icon, title, rows, total, countCol, totalRow }: {
  icon: LucideIcon; title: string; rows: [string, number][]; total: number; countCol: string; totalRow: string
}) {
  const { i18n } = useTranslation()
  const fmt = (n: number) => n.toLocaleString(i18n.language)
  const th: CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const td: CSSProperties = { padding: '6px 10px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)', fontVariantNumeric: 'tabular-nums' }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <Icon size={14} color="var(--color-primary)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>{title}</th>
            <th style={{ ...th, textAlign: 'right' }}>{countCol}</th>
            <th style={{ ...th, textAlign: 'right', width: 56 }}>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, n]) => (
            <tr key={label}>
              <td style={{ ...td, textAlign: 'left' }}>{label}</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 500 }}>{fmt(n)}</td>
              <td style={{ ...td, textAlign: 'right', color: 'var(--text-muted)' }}>
                {total ? `${Math.round((n / total) * 100)}%` : '—'}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, textAlign: 'left', fontWeight: 700, borderBottom: 'none' }}>{totalRow}</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700, borderBottom: 'none' }}>{fmt(total)}</td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700, borderBottom: 'none' }}>{total ? '100%' : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function ShiftsDrillDownTotals({ shifts, locationMeta }: {
  shifts: ShiftRow[]; locationMeta: LocationMeta
}) {
  const { t } = useTranslation('shiftmanager')
  const unknown = t('shiftsDrawer.unknown')

  // Resolve the location id once per row for the customer/location lookups.
  const locId = (s: ShiftRow) => String(s.order?.customer_location?.id ?? '')

  const total = shifts.length
  const byCustomer = useMemo(() => groupCounts(shifts, (s) =>
    locationMeta.get(locId(s))?.customer ?? String(s.order?.customer_location?.customer_external_id ?? ''), unknown), [shifts, locationMeta, unknown])
  const byFunction = useMemo(() => groupCounts(shifts, (s) => String(s.job_type ?? ''), unknown), [shifts, unknown])
  const byLocation = useMemo(() => groupCounts(shifts, (s) =>
    locationMeta.get(locId(s))?.name ?? String(s.order?.customer_location?.name ?? ''), unknown), [shifts, locationMeta, unknown])

  if (total === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontSize: 13, color: 'var(--text-muted)' }}>
        {t('shiftsDrawer.empty')}
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      <GroupTable icon={Building2} title={t('shiftsDrawer.byCustomer')} rows={byCustomer} total={total} countCol={t('shiftsDrawer.countCol')} totalRow={t('shiftsDrawer.totalRow')} />
      <GroupTable icon={Briefcase} title={t('shiftsDrawer.byFunction')} rows={byFunction} total={total} countCol={t('shiftsDrawer.countCol')} totalRow={t('shiftsDrawer.totalRow')} />
      <GroupTable icon={MapPin}    title={t('shiftsDrawer.byLocation')} rows={byLocation} total={total} countCol={t('shiftsDrawer.countCol')} totalRow={t('shiftsDrawer.totalRow')} />
    </div>
  )
}
