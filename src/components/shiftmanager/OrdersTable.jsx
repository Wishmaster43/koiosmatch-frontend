/**
 * OrdersTable — the shifts/orders report table.
 *
 * Shows the key columns (external id, order ref, status, customer, location,
 * date, times, worked hours, cost centers) with month/quarter filtering, search,
 * sorting and pagination. Clicking a row opens a DetailDrawer with every field.
 *
 * Main blocks below:
 *   - NOW / PAD / formatters → date + number helpers
 *   - enriched (useMemo)     → derive display fields from the raw API rows
 *   - DetailDrawer           → slide-in panel with the full record
 */
import { useState, useEffect, useMemo, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { useRightPanel }      from '../../context/RightPanelContext'
import { useAuth }            from '../../context/AuthContext'
import api                    from '../../lib/api'
import PaginationBar          from '../ui/PaginationBar'
import { useDefaultPageSize } from '../../lib/usePageSize'

const NOW = new Date()
const PAD = n => String(n).padStart(2, '0')

// Shift status → badge colours. Label = t('orders.status.<key>').
const STATUS_LABELS = {
  open:       { bg: '#F0F9FF', color: '#0369A1' },
  prognosis:  { bg: '#F5F3FF', color: '#6D28D9' },
  completed:  { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  in_process: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  cancelled:  { bg: 'var(--color-danger-bg)', color: '#E11D48' },
}

function StatusBadge({ status }) {
  const { t } = useTranslation('shiftmanager')
  const s = STATUS_LABELS[status] ?? { bg: 'var(--hover-bg)', color: 'var(--text-muted)' }
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500,
                   padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {status ? t(`orders.status.${status}`, { defaultValue: status }) : '—'}
    </span>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown size={12} style={{ color: 'var(--border)' }} />
  return dir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />
}

const TH = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
             color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
             whiteSpace: 'nowrap', userSelect: 'none' }
const TD = { padding: '9px 12px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)',
             whiteSpace: 'nowrap' }

const formatDate   = dt => { if (!dt) return '—'; const d = new Date(dt); return `${PAD(d.getDate())}-${PAD(d.getMonth()+1)}-${d.getFullYear()}` }
const formatTime   = dt => { if (!dt) return '—'; const d = new Date(dt); return `${PAD(d.getHours())}:${PAD(d.getMinutes())}` }
const formatHours  = h  => h != null ? Number(h).toFixed(2) : '—'
const dash         = v  => v || <span style={{ color: 'var(--border)' }}>—</span>

function DetailDrawer({ row, onClose }) {
  const { t } = useTranslation('shiftmanager')
  if (!row) return null

  const loc      = row.order?.customerLocation
  const customer = loc?.customer ?? row.order?.customer
  const invites  = row.invites ?? []

  const Field = ({ label, value }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)' }}>{value || '—'}</span>
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-40 overflow-y-auto"
        style={{ width: 400, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
                 boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('orders.drawer.title')}</h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{row.external_id ?? row.id}</p>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Section title={t('orders.drawer.identification')}>
            <Field label={t('orders.drawer.shiftId')}      value={row.id} />
            <Field label={t('orders.drawer.externalId')}   value={row.external_id} />
            <Field label={t('orders.drawer.scheduledId')}  value={row.scheduled_id ?? row.schedule_id} />
            <Field label={t('orders.drawer.orderRef')}     value={row.order?.order_ref} />
          </Section>

          <Section title={t('orders.drawer.planning')}>
            <Field label={t('orders.drawer.date')}         value={formatDate(row.start_time)} />
            <Field label={t('orders.drawer.startTime')}    value={formatTime(row.start_time)} />
            <Field label={t('orders.drawer.endTime')}      value={formatTime(row.end_time)} />
            <Field label={t('orders.drawer.jobType')}      value={row.job_type} />
            <Field label={t('orders.drawer.persons')}      value={row.number_persons} />
            <Field label={t('orders.drawer.status')}       value={row.own_status ? t(`orders.status.${row.own_status}`, { defaultValue: row.own_status }) : null} />
          </Section>

          <Section title={t('orders.drawer.customerLocation')}>
            <Field label={t('orders.drawer.customer')}     value={customer?.name} />
            <Field label={t('orders.drawer.location')}     value={loc?.name} />
            <Field label={t('orders.drawer.address')}      value={loc?.address} />
          </Section>

          <Section title={t('orders.drawer.hours')}>
            <Field label={t('orders.drawer.hoursCand')}    value={formatHours(row.worked_hours_candidate ?? row.hours_worked)} />
            <Field label={t('orders.drawer.hoursCust')}    value={formatHours(row.worked_hours_customer  ?? row.billed_hours)} />
            <Field label={t('orders.drawer.ccCand')}       value={row.cost_center_candidate ?? row.cost_center} />
            <Field label={t('orders.drawer.ccCust')}       value={row.cost_center_customer  ?? row.order?.cost_center} />
          </Section>

          {invites.length > 0 && (
            <Section title={t('orders.drawer.candidates')}>
              {invites.map((inv, i) => {
                const c = inv.candidate
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '8px 10px', background: 'var(--bg)',
                                        borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                  background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 700 }}>
                      {c ? `${(c.first_name??'')[0]??''}${(c.last_name??'')[0]??''}`.toUpperCase() : '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                        {c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {inv.status ?? ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </Section>
          )}

          {row.notes && (
            <Section title={t('orders.drawer.notes')}>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{row.notes}</p>
            </Section>
          )}
        </div>
      </div>
    </>
  )
}

function Section({ title, children }) {
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

const COL_KEYS = [
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

export default function OrdersTable() {
  const { t } = useTranslation('shiftmanager')
  const COLS = COL_KEYS.map(c => ({ ...c, label: t(`orders.cols.${c.tKey}`) }))
  const defaultPageSize                        = useDefaultPageSize()
  const { refreshUser }                        = useAuth()
  const [{ rows, loading, total, lastPage: lp }, dispatch] = useReducer(
    (_, a) => a,
    { rows: [], loading: true, total: 0, lastPage: 1 }
  )
  const [search,           setSearch]           = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState([])
  const [selectedMonth,    setSelectedMonth]    = useState('')
  const [sort,             setSort]             = useState({ key: 'start_date', dir: 'desc' })
  const [page,             setPage]             = useState(1)
  const [pageSize,         setPageSize]         = useState(defaultPageSize)
  const [selected,         setSelected]         = useState(null)

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => { setPage(1) }, [selectedMonth, pageSize])

  useEffect(() => {
    dispatch({ rows: [], loading: true, total: 0, lastPage: 1 })
    api.get('/sm_reports/shifts-per-month/detail', {
      params: {
        ...(selectedMonth ? { month: selectedMonth } : {}),
        metric: 'totaal', per_page: pageSize, page,
      },
    })
      .then(res => {
        const body = res.data
        dispatch({
          rows:     body?.data ?? (Array.isArray(body) ? body : []),
          loading:  false,
          total:    body?.meta?.total ?? body?.total ?? 0,
          lastPage: body?.meta?.last_page ?? body?.last_page ?? 1,
        })
      })
      .catch(() => dispatch({ rows: [], loading: false, total: 0, lastPage: 1 }))
  }, [selectedMonth, page, pageSize])

  const handlePageSizeChange = async (newSize) => {
    setPageSize(newSize)
    try {
      await api.put('/auth/me', { default_per_page: newSize })
      await refreshUser()
    } catch { /* noop */ }
  }

  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.own_status).filter(Boolean))].sort(), [rows])

  // Enrich rows with derived sort keys
  const enriched = useMemo(() => rows.map(r => ({
    ...r,
    customer_name:          r.order?.customerLocation?.customer?.name ?? r.order?.customer?.name ?? '',
    location_name:          r.order?.customerLocation?.name ?? '',
    start_date:             r.start_time ? r.start_time.slice(0, 10) : '',
    cost_center_candidate:  r.cost_center_candidate ?? r.cost_center ?? '',
    cost_center_customer:   r.cost_center_customer ?? r.order?.cost_center ?? '',
    worked_hours_candidate: r.worked_hours_candidate ?? r.hours_worked ?? null,
    worked_hours_customer:  r.worked_hours_customer ?? r.billed_hours ?? null,
    order_ref:              r.order?.order_ref ?? '',
  })), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enriched.filter(r => {
      if (selectedStatuses.length && !selectedStatuses.includes(r.own_status)) return false
      if (!q) return true
      return (
        (r.external_id    ?? '').toString().toLowerCase().includes(q) ||
        (r.order_ref      ?? '').toLowerCase().includes(q) ||
        (r.customer_name  ?? '').toLowerCase().includes(q) ||
        (r.location_name  ?? '').toLowerCase().includes(q) ||
        (r.job_type       ?? '').toLowerCase().includes(q)
      )
    })
  }, [enriched, search, selectedStatuses])

  const sorted = useMemo(() => {
    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      const av = (a[key] ?? '').toString().toLowerCase()
      const bv = (b[key] ?? '').toString().toLowerCase()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ?  1 : -1
      return 0
    })
  }, [filtered, sort])

  const setSort_ = key => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  const filterGroups = useMemo(() => [{
    key: 'status', label: t('orders.filterStatus'),
    selected: selectedStatuses,
    options: statusOptions.map(s => ({
      value: s,
      label: t(`orders.status.${s}`, { defaultValue: s }),
      count: rows.filter(r => r.own_status === s).length,
    })),
    onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
  }], [t, selectedStatuses, statusOptions, rows])

  useEffect(() => {
    registerFilters('orders-table', filterGroups)
    return () => unregisterFilters('orders-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 0; i < 24; i++) {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1)
      opts.push(`${d.getFullYear()}-${PAD(d.getMonth()+1)}`)
    }
    return opts
  }, [])

  // Locale-aware "mon yyyy" label for the month dropdown.
  const formatMonth = m => {
    const [y, mo] = m.split('-')
    return `${new Date(Number(y), Number(mo) - 1, 1).toLocaleString(undefined, { month: 'short' })} ${y}`
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
                     borderRadius: 8, color: 'var(--text)', background: 'white', cursor: 'pointer' }}>
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
        totalPages={lp}
        totalRows={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />

      <DetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
