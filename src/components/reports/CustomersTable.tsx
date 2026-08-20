/**
 * CustomersTable — searchable, sortable, paginated table of customers.
 * Clicking a row opens CustomerDetailDrawer. Filters come from RightPanelContext,
 * page size from the user's preference; data is fetched per page from the API.
 */
import { useState, useEffect, useMemo } from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import SortCaret from '@/components/ui/SortCaret'
import Spinner from '@/components/ui/Spinner'
import { useRightPanel }      from '@/context/RightPanelContext'
import CustomerDetailDrawer   from './CustomerDetailDrawer'
import PaginationBar          from '../ui/PaginationBar'
import { usePersistedPageSize } from '@/hooks/usePersistedPageSize'
import { useReportCustomers } from './useReportCustomers'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill
import type { ReportCustomer, SortState } from '@/types/reports'

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  // Delegates to the ONE shared caret recipe (HUISSTIJL-1).
  return <SortCaret active={active} dir={dir} />
}

const TH: CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
             color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
             whiteSpace: 'nowrap', userSelect: 'none' }
const TD: CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

export default function CustomersTable() {
  const { t } = useTranslation('reports')
  // Reuses the existing common.sort key for the sortable header's button tooltip
  // (mirrors DataTable's own sortable header — no new i18n keys needed).
  const { t: tCommon } = useTranslation('common')
  // Data (fetch + dev-mock merge) lives in the shared hook (§3).
  const { customers, loading, error } = useReportCustomers()
  const [search,            setSearch]            = useState('')
  const [selectedStatuses,  setSelectedStatuses]  = useState<Array<string | number>>(['active'])
  const [sort,              setSort]              = useState<SortState>({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(1)
  const { pageSize, handlePageSizeChange } = usePersistedPageSize()
  const [detail,            setDetail]            = useState<ReportCustomer | null>(null)

  const { registerFilters, unregisterFilters } = useRightPanel()

  const statusOptions = useMemo(() =>
    [...new Set(customers.map(c => c.status).filter((x): x is string => Boolean(x)))].sort(),
    [customers])

  const toggle = (setter: Dispatch<SetStateAction<Array<string | number>>>) => (val: string | number) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter(c => {
      if (selectedStatuses.length && !selectedStatuses.includes(c.status as string)) return false
      if (!q) return true
      return (
        (c.name             ?? '').toLowerCase().includes(q) ||
        (c.debtor_number    ?? '').toLowerCase().includes(q) ||
        (c.account_manager  ?? '').toLowerCase().includes(q) ||
        (c.external_id      ?? '').toString().includes(q)
      )
    })
  }, [customers, search, selectedStatuses])

  const sorted = useMemo(() => {
    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      let av: string | number, bv: string | number
      if (key === 'locations')   { av = a.locations?.length ?? 0;  bv = b.locations?.length ?? 0 }
      else if (key === 'departments') {
        av = (a.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)
        bv = (b.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)
      } else {
        av = (a[key] ?? '').toString().toLowerCase()
        bv = (b[key] ?? '').toString().toLowerCase()
      }
      if ((av as number) < (bv as number)) return dir === 'asc' ? -1 : 1
      if ((av as number) > (bv as number)) return dir === 'asc' ? 1  : -1
      return 0
    })
  }, [filtered, sort])

  useEffect(() => setPage(1), [filtered.length, pageSize])
  const paged     = useMemo(() => sorted.slice((page-1)*pageSize, page*pageSize), [sorted, page, pageSize])
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const setSort_ = (key: string) => setSort(prev =>
    prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
  )

  const filterGroups = useMemo(() => [
    {
      key: 'status', label: t('customers.filters.status'),
      selected: selectedStatuses,
      options: statusOptions.map(s => ({
        value: s,
        label: s === 'active' ? t('customers.statusActive') : s === 'inactive' ? t('customers.statusInactive') : s,
        count: customers.filter(c => c.status === s).length,
      })),
      onToggle: toggle(setSelectedStatuses),
    },
  ], [t, selectedStatuses, statusOptions, customers])

  useEffect(() => {
    registerFilters('customers-table', filterGroups)
    return () => unregisterFilters('customers-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  const COLS = [
    { key: 'name',          label: t('customers.cols.name'),          sortable: true },
    { key: 'debtor_number', label: t('customers.cols.debtorNumber'),  sortable: true },
    { key: 'status',        label: t('customers.cols.status'),        sortable: true },
    { key: 'account_manager', label: t('customers.cols.accountManager'), sortable: true },
    { key: 'locations',     label: t('customers.cols.locations'),     sortable: true },
    { key: 'departments',   label: t('customers.cols.departments'),   sortable: true },
  ]

  return (
    <div className="flex flex-col h-full">

      {/* Header: title + summary + search — mirrors the sibling SM entity tables
          (DepartmentsTable/LocationsTable), was missing here so `search` state
          had no control feeding it (§3 "control that goes nowhere" audit fix). */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('customers.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {loading ? t('common.loadingShort') : t('customers.summary', { shown: filtered.length, total: customers.length })}
          </p>
        </div>
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                     transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('customers.search')}
            style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                     border: '1px solid var(--border)', borderRadius: 8, outline: 'none', color: 'var(--text)' }} />
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, fontSize: 13,
                      // Ink is --color-on-danger-bg — the raw danger colour reads only
                      // 3.95:1 on its own pastel, AA fail (Opus r3.5).
                      color: 'var(--color-on-danger-bg)',
                      // eslint-disable-next-line no-restricted-syntax -- DATA: danger-border companion colour paired with the danger-bg tokens above; no exact token match for this specific soft-border shade
                      background: 'var(--color-danger-bg)', border: '1px solid #FECACA', borderRadius: 8 }}>
          {t('customers.loadError')}
        </div>
      )}

      {/* Table */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
        style={{ border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3" style={{ height: 240 }}>
              <span style={{ color: 'var(--border)' }}><Spinner size={18} /></span>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('customers.loading')}</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: 180 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('customers.empty')}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {COLS.map(col => {
                    // Plain header — no sort affordance, no aria-sort (mirrors DataTable's
                    // own non-sortable column, which never gets aria-sort either).
                    if (!col.sortable) return <th key={col.key} style={TH}>{col.label}</th>
                    const active = sort.key === col.key
                    // Present ('none' for inactive) on EVERY sortable column so a screen
                    // reader can tell it is sortable at all, not just the active one.
                    const ariaSort: 'ascending' | 'descending' | 'none' =
                      active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                    const { padding: thPadding, ...thStyleRest } = TH
                    return (
                      <th key={col.key} style={thStyleRest} aria-sort={ariaSort}>
                        {/* Real <button> inside the <th> (not tabIndex+onKeyDown on the th) —
                            gives Tab reachability + native Enter/Space activation; mirrors the
                            shared DataTable's sortable header exactly. */}
                        <button type="button" onClick={() => setSort_(col.key)} title={tCommon('sort')}
                          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- table-header sort control (all:unset reset), mirrors the shared DataTable's own sortable header, pre-existing and out of this ink/tint task's scope
                          style={{ all: 'unset', boxSizing: 'border-box', display: 'inline-flex', width: '100%',
                            padding: thPadding, cursor: 'pointer', userSelect: 'none', alignItems: 'center', gap: 4,
                            font: 'inherit', color: 'inherit' }}>
                          {col.label}
                          <SortIcon active={active} dir={sort.dir} />
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => {
                  const locCount  = c.locations?.length ?? 0
                  const deptCount = (c.locations ?? []).reduce((s, l) => s + (l.departments?.length ?? 0), 0)
                  return (
                    <tr key={c.id ?? i}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setDetail(c)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={TD}>
                        <span style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</span>
                      </td>
                      <td style={TD}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {c.debtor_number || <span style={{ color: 'var(--border)' }}>—</span>}
                        </span>
                      </td>
                      <td style={TD}><StatusBadge status={c.status} /></td>
                      <td style={TD}>{c.account_manager || <span style={{ color: 'var(--border)' }}>—</span>}</td>
                      <td style={TD}>
                        <span style={{ fontWeight: 500 }}>{locCount}</span>
                        {locCount === 0 && <span style={{ color: 'var(--border)', marginLeft: 4, fontSize: 11 }}>—</span>}
                      </td>
                      <td style={TD}>
                        <span style={{ fontWeight: 500 }}>{deptCount}</span>
                        {deptCount === 0 && <span style={{ color: 'var(--border)', marginLeft: 4, fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <PaginationBar page={page} totalPages={totalPages} totalRows={sorted.length}
        pageSize={pageSize} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} />

      {detail && (
        <CustomerDetailDrawer customer={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
