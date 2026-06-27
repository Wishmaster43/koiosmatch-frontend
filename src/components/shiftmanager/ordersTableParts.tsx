/**
 * OrdersTable building blocks — shared dumb pieces: the status badge, sort icon,
 * table cell/header styles, the date/number formatters, the section card used in
 * the detail drawer, and the column config. No data fetching here.
 */
import { useTranslation } from 'react-i18next'
import type { CSSProperties, ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export const NOW = new Date()
export const PAD = (n: number) => String(n).padStart(2, '0')

// Shift status → badge colours. Label = t('orders.status.<key>').
export const STATUS_LABELS: Record<string, { bg: string; color: string }> = {
  open:       { bg: '#F0F9FF', color: '#0369A1' },
  prognosis:  { bg: '#F5F3FF', color: '#6D28D9' },
  completed:  { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  in_process: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  cancelled:  { bg: 'var(--color-danger-bg)', color: '#E11D48' },
}

export function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('shiftmanager')
  const s = STATUS_LABELS[status ?? ''] ?? { bg: 'var(--hover-bg)', color: 'var(--text-muted)' }
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500,
                   padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {status ? t(`orders.status.${status}`, { defaultValue: status }) : '—'}
    </span>
  )
}

export function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={12} style={{ color: 'var(--border)' }} />
  return dir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />
}

export const TH: CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                    color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap', userSelect: 'none' }
export const TD: CSSProperties = { padding: '9px 12px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)',
                    whiteSpace: 'nowrap' }

export const formatDate   = (dt?: string | number | Date | null) => { if (!dt) return '—'; const d = new Date(dt); return `${PAD(d.getDate())}-${PAD(d.getMonth()+1)}-${d.getFullYear()}` }
export const formatTime   = (dt?: string | number | Date | null) => { if (!dt) return '—'; const d = new Date(dt); return `${PAD(d.getHours())}:${PAD(d.getMinutes())}` }
export const formatHours  = (h?: number | string | null) => h != null ? Number(h).toFixed(2) : '—'
export const dash         = (v: unknown): ReactNode => v ? (v as ReactNode) : <span style={{ color: 'var(--border)' }}>—</span>

// Section card with an uppercase title — used by the detail drawer.
export function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.07em', marginBottom: 10 }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10,
                    padding: '12px 14px', background: 'var(--bg)',
                    borderRadius: 10, border: '1px solid var(--border)' }}>
        {children}
      </div>
    </div>
  )
}

// Visible columns: data key, i18n key (orders.cols.<tKey>) and whether sortable.
export const COL_KEYS = [
  { key: 'external_id',            tKey: 'extId',     sortable: true  },
  { key: 'order_ref',              tKey: 'orderRef',  sortable: false },
  { key: 'own_status',             tKey: 'status',    sortable: true  },
  { key: 'customer_name',          tKey: 'customer',  sortable: true  },
  { key: 'location_name',          tKey: 'location',  sortable: true  },
  { key: 'start_date',             tKey: 'date',      sortable: true  },
  { key: 'start_time',             tKey: 'start',     sortable: true  },
  { key: 'end_time',               tKey: 'end',       sortable: false },
  { key: 'worked_hours_candidate', tKey: 'hoursCand', sortable: false },
  { key: 'worked_hours_customer',  tKey: 'hoursCust', sortable: false },
  { key: 'cost_center_candidate',  tKey: 'ccCand',    sortable: false },
  { key: 'cost_center_customer',   tKey: 'ccCust',    sortable: false },
]
