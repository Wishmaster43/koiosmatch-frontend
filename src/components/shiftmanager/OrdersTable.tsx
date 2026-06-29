/**
 * OrdersTable — the shifts/orders report table.
 *
 * Shows the key columns (external id, order ref, status, customer, location,
 * date, times, worked hours, cost centers) with month/quarter filtering, search,
 * sorting and pagination. Clicking a row opens OrderDetailDrawer with every field.
 * Thin container: data + paging come from useOrdersTable; this owns the filter UI.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import PaginationBar     from '../ui/PaginationBar'
import {
  NOW, PAD, StatusBadge, SortIcon, TH, TD,
  formatDate, formatTime, formatHours, dash, COL_KEYS,
} from './ordersTableParts'
import OrderDetailDrawer from './OrderDetailDrawer'
import { useOrdersTable } from './useOrdersTable'
import type { EnrichedOrderRow } from '@/types/shiftmanager'

export default function OrdersTable() {
  const { t } = useTranslation('shiftmanager')
  const COLS = COL_KEYS.map(c => ({ ...c, label: t(`orders.cols.${c.tKey}`) }))

  // UI filter state (the data hook owns rows + paging).
  const [search,           setSearch]           = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedMonth,    setSelectedMonth]    = useState('')
  const [sort,             setSort]             = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'start_date', dir: 'desc' })
  const [selected,         setSelected]         = useState<EnrichedOrderRow | null>(null)

  const { rows, loading, total, lastPage, page, setPage, pageSize, handlePageSizeChange, statusOptions, sorted } =
    useOrdersTable({ selectedMonth, search, selectedStatuses, sort })

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Toggle sort direction, or switch the sorted column (default desc).
  const setSort_ = (key: string) => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  // Status filter group for the right panel.
  const filterGroups = useMemo(() => [{
    key: 'status', label: t('orders.filterStatus'),
    selected: selectedStatuses,
    options: statusOptions.map(s => ({
      value: s,
      label: t(`orders.status.${s}`, { defaultValue: s }),
      count: rows.filter(r => r.own_status === s).length,
    })),
    onToggle: (v: string) => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
  }], [t, selectedStatuses, statusOptions, rows])

  useEffect(() => {
    registerFilters('orders-table', filterGroups)
    return () => unregisterFilters('orders-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Last 24 months as "YYYY-MM" for the month dropdown.
  const monthOptions = useMemo(() => {
    const opts: string[] = []
    for (let i = 0; i < 24; i++) {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1)
      opts.push(`${d.getFullYear()}-${PAD(d.getMonth()+1)}`)
    }
    return opts
  }, [])

  // Locale-aware "mon yyyy" label for the month dropdown.
  const formatMonth = (m: string) => {
    const [y, mo] = m.split('-')
    return `${new Date(Number(y), Number(mo) - 1, 1).toLocaleString('nl-NL', { month: 'short' })} ${y}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('orders.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {loading ? t('charts.loading') : t('orders.count', { count: total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ height: 34, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)',
                     borderRadius: 8, color: 'var(--text)', background: 'var(--surface)', cursor: 'pointer' }}>
            <option value="">{t('orders.allMonths')}</option>
            {monthOptions.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
          <div className="relative">
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                       transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('orders.search')}
              style={{ height: 34, width: 240, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                       border: '1px solid var(--border)', borderRadius: 8, outline: 'none', color: 'var(--text)' }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
        style={{ border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {COLS.map(col => (
                  <th key={col.key} style={{ ...TH, cursor: col.sortable ? 'pointer' : 'default' }}
                    onClick={() => col.sortable && setSort_(col.key)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      {col.sortable && <SortIcon active={sort.key === col.key} dir={sort.dir} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>
                  {t('orders.loading')}
                </td></tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontSize: 13 }}>
                  {t('orders.empty')}
                </td></tr>
              )}
              {!loading && sorted.map((r, i) => (
                <tr key={r.id ?? i}
                  onClick={() => setSelected(r)}
                  style={{ cursor: 'pointer', background: selected?.id === r.id ? 'var(--color-secondary-bg)' : undefined }}
                  onMouseEnter={e => { if (selected?.id !== r.id) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { if (selected?.id !== r.id) e.currentTarget.style.background = 'transparent' }}>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                    {dash(r.external_id)}
                  </td>
                  <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11 }}>
                    {dash(r.order_ref)}
                  </td>
                  <td style={TD}><StatusBadge status={r.own_status} /></td>
                  <td style={{ ...TD, fontWeight: 500, color: 'var(--text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dash(r.customer_name)}
                  </td>
                  <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dash(r.location_name)}
                  </td>
                  <td style={TD}>{formatDate(r.start_time)}</td>
                  <td style={TD}>{formatTime(r.start_time)}</td>
                  <td style={TD}>{formatTime(r.end_time)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatHours(r.worked_hours_candidate)}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatHours(r.worked_hours_customer)}
                  </td>
                  <td style={{ ...TD, fontSize: 11, color: 'var(--text-muted)' }}>{dash(r.cost_center_candidate)}</td>
                  <td style={{ ...TD, fontSize: 11, color: 'var(--text-muted)' }}>{dash(r.cost_center_customer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar
        page={page}
        totalPages={lastPage}
        totalRows={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />

      <OrderDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
