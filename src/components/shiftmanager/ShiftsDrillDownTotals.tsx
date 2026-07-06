/**
 * ShiftsDrillDownTotals — the drill-down as grouped TOTALS instead of an order
 * list (Danny: "geen lijsten van orders maar totalen — per klant, per functie,
 * per locatie"). Aggregates the shifts behind one month/metric into three
 * per-group tables, switchable between number of shifts and worked hours. The
 * customer name is resolved from the location id via `locationMeta` (the detail
 * rows only carry a customer_external_id).
 */
import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Briefcase, MapPin } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ShiftRow } from '@/types/shiftmanager'

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
function GroupTable({ icon: Icon, title, rows, total, valueCol, totalRow, fmt }: {
  icon: LucideIcon; title: string; rows: [string, number][]; total: number; valueCol: string; totalRow: string; fmt: (n: number) => string
}) {
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
  const { t, i18n } = useTranslation('shiftmanager')
  const unknown = t('shiftsDrawer.unknown')
  // Switch the aggregated value between number of shifts and worked hours.
  const [unit, setUnit] = useState<'count' | 'hours'>('count')

  // Resolve the location id once per row for the customer/location lookups.
  const locId = (s: ShiftRow) => String(s.order?.customer_location?.id ?? '')
  const valFn = (s: ShiftRow) => unit === 'hours' ? shiftHours(s) : 1

  const total = useMemo(() => shifts.reduce((sum, s) => sum + valFn(s), 0), [shifts, unit]) // eslint-disable-line react-hooks/exhaustive-deps
  const byCustomer = useMemo(() => groupSum(shifts, (s) =>
    locationMeta.get(locId(s))?.customer ?? String(s.order?.customer_location?.customer_external_id ?? ''), valFn, unknown), [shifts, locationMeta, unknown, unit]) // eslint-disable-line react-hooks/exhaustive-deps
  const byFunction = useMemo(() => groupSum(shifts, (s) => String(s.job_type ?? ''), valFn, unknown), [shifts, unknown, unit]) // eslint-disable-line react-hooks/exhaustive-deps
  const byLocation = useMemo(() => groupSum(shifts, (s) =>
    locationMeta.get(locId(s))?.name ?? String(s.order?.customer_location?.name ?? ''), valFn, unknown), [shifts, locationMeta, unknown, unit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Shifts as whole numbers, hours with one decimal (nl-NL / active locale).
  const fmt = (n: number) => n.toLocaleString(i18n.language, unit === 'hours' ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : {})
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
      {/* Diensten / Uren switch */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {(['count', 'hours'] as const).map(u => (
            <button key={u} type="button" onClick={() => setUnit(u)}
              style={{ padding: '4px 12px', fontSize: 11, fontWeight: unit === u ? 600 : 400, border: 'none', cursor: 'pointer',
                background: unit === u ? 'var(--color-primary-bg)' : 'transparent',
                color: unit === u ? 'var(--color-primary)' : 'var(--text-muted)' }}>
              {u === 'count' ? t('shiftsDrawer.countCol') : t('shiftsDrawer.byHours')}
            </button>
          ))}
        </div>
      </div>
      <GroupTable icon={Building2} title={t('shiftsDrawer.byCustomer')} rows={byCustomer} total={total} valueCol={valueCol} totalRow={t('shiftsDrawer.totalRow')} fmt={fmt} />
      <GroupTable icon={Briefcase} title={t('shiftsDrawer.byFunction')} rows={byFunction} total={total} valueCol={valueCol} totalRow={t('shiftsDrawer.totalRow')} fmt={fmt} />
      <GroupTable icon={MapPin}    title={t('shiftsDrawer.byLocation')} rows={byLocation} total={total} valueCol={valueCol} totalRow={t('shiftsDrawer.totalRow')} fmt={fmt} />
    </div>
  )
}
