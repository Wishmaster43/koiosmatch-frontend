/**
 * CandidatesTable — searchable, sortable table of candidates.
 * Shows a status badge per candidate; clicking a row opens CandidateDetailDrawer.
 * Filters come from RightPanelContext. StatusBadge below = the colored status pill.
 */
import { useState, useEffect, useMemo } from 'react'
import type { ReactNode, Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw } from 'lucide-react'
import CandidateDetailDrawer from './CandidateDetailDrawer'
import { useRightPanel }     from '@/context/RightPanelContext'
import type { ReportCandidate, ReportColumn, SortState } from '@/types/reports'

// Colored status pill (actief / nietactief / extern / ...) for a candidate row.
function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('reports')
  const styles: Record<string, { bg: string; color: string }> = {
    actief:     { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    nietactief: { bg: 'var(--color-warning-bg)', color: '#C2410C' },
    extern:     { bg: 'var(--color-secondary-bg)', color: '#1D4ED8' },
    intake:     { bg: '#FAF5FF', color: '#7C3AED' },
    verwijderd: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
  }
  const key = (status || '').toLowerCase().replace(/\s+/g, '')
  const s = styles[key] || { bg: 'var(--hover-bg)', color: 'var(--text-muted)' }
  const label = status ? t(`candidates.status.${key}`, { defaultValue: status }) : t('candidates.unknown')
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500,
                   padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function fmtDate(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TagPill({ value, color = 'var(--color-primary)', bg = 'var(--color-primary-bg)' }: { value: ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 5,
                   background: bg, color, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

function TagCell({ items, color, bg }: { items?: ReactNode[]; color?: string; bg?: string }) {
  if (!items?.length) return <span style={{ color: 'var(--border)' }}>—</span>
  const visible = items.slice(0, 2)
  const rest    = items.length - 2
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((v, i) => <TagPill key={i} value={v} color={color} bg={bg} />)}
      {rest > 0 && <TagPill value={`+${rest}`} color="var(--text-muted)" bg="var(--border)" />}
    </div>
  )
}

function RateCell({ candidate }: { candidate: ReportCandidate }) {
  const { t } = useTranslation('reports')
  const rates = candidate.global_rate_summary
  if (!Array.isArray(rates) || !rates.length) return <span style={{ color: 'var(--border)' }}>—</span>
  const visible = rates.slice(0, 2)
  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((r, i) => (
        <span key={i} style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {r.global_rate?.internal_description ?? r.step_name ?? '—'}:&nbsp;
          </span>
          {r.hour_rate != null ? `€${Number(r.hour_rate).toFixed(2)}` : '—'}
        </span>
      ))}
      {rates.length > 2 && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('candidates.more', { count: rates.length - 2 })}</span>
      )}
    </div>
  )
}

function parseKenmerken(v?: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(item => item?.name ?? String(item)).filter(Boolean)
}

// Column definitions; labels are resolved from i18n via the `t` passed in.
function buildColumns(t: TFunction): ReportColumn[] {
  return [
  { key: 'name', label: t('candidates.cols.name'), type: 'string',
    value: c => `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim(),
    render: c => (
      <div>
        <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: 13 }}>
          {`${c.firstname ?? ''} ${c.lastname ?? ''}`.trim() || '—'}
        </div>
        {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>}
      </div>
    )},
  { key: 'status', label: t('candidates.cols.status'), type: 'string',
    value: c => c.status || '',
    render: c => <StatusBadge status={c.status} /> },
  { key: 'position', label: t('candidates.cols.position'), type: 'string',
    value: c => c.position || '',
    render: c => <span style={{ fontSize: 13 }}>{c.position || '—'}</span> },
  { key: 'mobile', label: t('candidates.cols.mobile'), type: 'string',
    value: c => c.mobile ?? c.phone ?? '',
    render: c => <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{c.mobile ?? c.phone ?? '—'}</span> },
  { key: 'registration_date', label: t('candidates.cols.registration'), type: 'date',
    value: c => c.registration_date || null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.registration_date)}</span> },
  { key: 'last_login_at', label: t('candidates.cols.lastLogin'), type: 'date',
    value: c => c.last_login_at || null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.last_login_at)}</span> },
  { key: 'last_planned_shift', label: t('candidates.cols.plannedShift'), type: 'date',
    value: c => c.last_planned_shift || null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.last_planned_shift)}</span> },
  { key: 'last_worked_shift', label: t('candidates.cols.lastShift'), type: 'date',
    value: c => c.last_worked_shift || null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.last_worked_shift)}</span> },
  { key: 'number_of_times_worked', label: t('candidates.cols.shifts'), type: 'number', align: 'right',
    value: c => Number(c.number_of_times_worked) || 0,
    render: c => <span style={{ fontSize: 13 }}>{c.number_of_times_worked ?? 0}</span> },
  { key: 'features', label: t('candidates.cols.features'), type: 'string',
    value: c => parseKenmerken(c.features).join(', '),
    render: c => <TagCell items={parseKenmerken(c.features)} color="var(--color-primary)" bg="var(--color-primary-bg)" /> },
  { key: 'global_rate', label: t('candidates.cols.globalRates'), type: 'string',
    value: () => '',
    render: c => <RateCell candidate={c} /> },
  ]
}

function compareValues(a: ReportCandidate, b: ReportCandidate, col: ReportColumn, dir: 'asc' | 'desc') {
  const av = col.value(a)
  const bv = col.value(b)
  const aE = av === null || av === undefined || av === ''
  const bE = bv === null || bv === undefined || bv === ''
  if (aE && bE) return 0
  if (aE) return 1
  if (bE) return -1
  let cmp: number
  if (col.type === 'number')    cmp = Number(av) - Number(bv)
  else if (col.type === 'date') cmp = new Date(av as string).getTime() - new Date(bv as string).getTime()
  else                          cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
  return dir === 'asc' ? cmp : -cmp
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={11} style={{ color: 'var(--border)' }} />
  return dir === 'asc'
    ? <ChevronUp size={11} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={11} style={{ color: 'var(--color-primary)' }} />
}

export default function CandidatesTable({ candidates = [], loading = false, statusFilter, setStatusFilter }: {
  candidates?: ReportCandidate[]; loading?: boolean
  // Optional controlled status filter — lets a KPI row above the table drive it
  // (candidates-table page). Uncontrolled default = Actief when not provided.
  statusFilter?: Array<string | number>
  setStatusFilter?: Dispatch<SetStateAction<Array<string | number>>>
}) {
  const { t } = useTranslation('reports')
  const columns = useMemo(() => buildColumns(t), [t])
  const [search, setSearch]                       = useState('')
  const { registerFilters, unregisterFilters }    = useRightPanel()
  const [selectedYears, setSelectedYears]         = useState<Array<string | number>>([])
  const [internalStatuses, setInternalStatuses]   = useState<Array<string | number>>(['actief'])
  const selectedStatuses    = statusFilter ?? internalStatuses
  const setSelectedStatuses = setStatusFilter ?? setInternalStatuses
  const [selectedPositions, setSelectedPositions] = useState<Array<string | number>>([])
  const [selectedKenmerken, setSelectedKenmerken] = useState<Array<string | number>>([])
  const [sort, setSort]                           = useState<SortState>({ key: 'name', dir: 'asc' })
  const [detail, setDetail]                       = useState<ReportCandidate | null>(null)

  // Build a toggle handler that adds/removes a value from a selected-set state.
  const toggle = (setter: Dispatch<SetStateAction<Array<string | number>>>) => (value: string | number) =>
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])

  const statusOptions = useMemo(() =>
    [...new Set(candidates.map(c => c.status).filter((x): x is string => Boolean(x)))].sort(), [candidates])

  const positionOptions = useMemo(() =>
    [...new Set(candidates.map(c => c.position).filter((x): x is string => Boolean(x)))].sort(), [candidates])

  const yearOptions = useMemo(() => {
    const ys = candidates
      .map(c => c.registration_date ? new Date(c.registration_date).getFullYear() : null)
      .filter((y): y is number => !!y && !isNaN(y))
    return [...new Set(ys)].sort((a, b) => b - a)
  }, [candidates])

  const kenmerkOptions = useMemo(() => {
    const all = candidates.flatMap(c =>
      Array.isArray(c.features) ? c.features.map(f => f.name).filter((x): x is string => Boolean(x)) : []
    )
    return [...new Set(all)].sort()
  }, [candidates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates.filter(c => {
      if (selectedStatuses.length  && !selectedStatuses.includes(c.status as string))    return false
      if (selectedPositions.length && !selectedPositions.includes(c.position as string)) return false
      if (selectedYears.length) {
        const y = c.registration_date ? new Date(c.registration_date).getFullYear() : null
        if (!selectedYears.includes(y as number)) return false
      }
      if (selectedKenmerken.length) {
        const cKenmerken = parseKenmerken(c.features)
        if (!selectedKenmerken.some(k => cKenmerken.includes(k as string))) return false
      }
      if (q) {
        const hay = [c.firstname, c.lastname, c.email, c.position, c.city, c.mobile, c.phone]
          .join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [candidates, selectedStatuses, selectedPositions, selectedYears, selectedKenmerken, search])

  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sort.key)
    if (!col) return filtered
    return [...filtered].sort((a, b) => compareValues(a, b, col, sort.dir))
  }, [filtered, sort, columns])

  const onSort = (key: string) =>
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })

  const filterGroups = useMemo(() => [
    { key: 'jaar', label: t('candidates.filters.year'),
      options: yearOptions.map(y => ({ value: y, label: String(y) })),
      selected: selectedYears, onToggle: toggle(setSelectedYears) },
    { key: 'status', label: t('candidates.filters.status'),
      options: statusOptions.map(s => ({ value: s, label: t(`candidates.status.${(s||'').toLowerCase().replace(/\s+/g,'')}`, { defaultValue: s }) })),
      selected: selectedStatuses, onToggle: toggle(setSelectedStatuses) },
    { key: 'functie', label: t('candidates.filters.position'),
      options: positionOptions.map(p => ({ value: p, label: p })),
      selected: selectedPositions, onToggle: toggle(setSelectedPositions) },
    { key: 'kenmerken', label: t('candidates.filters.features'),
      options: kenmerkOptions.map(k => ({ value: k, label: k })),
      selected: selectedKenmerken, onToggle: toggle(setSelectedKenmerken) },
  ], [t, yearOptions, statusOptions, positionOptions, kenmerkOptions,
      selectedYears, selectedStatuses, selectedPositions, selectedKenmerken, setSelectedStatuses])

  useEffect(() => {
    registerFilters('candidates-table', filterGroups)
    return () => unregisterFilters('candidates-table')
  }, [filterGroups, registerFilters, unregisterFilters])


  return (
    <div className="flex flex-col h-full">

      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('candidates.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {t('candidates.summary', { shown: filtered.length, total: candidates.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                       transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('candidates.search')}
              style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                       border: '1px solid var(--border)', borderRadius: 8, outline: 'none', color: 'var(--text)' }} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
        style={{ border: '1px solid var(--border)' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3"
              style={{ height: '100%', minHeight: 300 }}>
              <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--border)' }} />
              <p className="text-sm text-[var(--text-muted)]">{t('candidates.loading')}</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center"
              style={{ height: '100%', minHeight: 300 }}>
              <p className="text-sm font-medium text-[var(--text-muted)]">{t('candidates.empty')}</p>
              <p className="text-xs text-[var(--text-muted)]">{t('candidates.emptyHint')}</p>
            </div>
          ) : (
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)' }}>
                  {columns.map(col => {
                    const active = sort.key === col.key
                    return (
                      <th key={col.key} onClick={() => onSort(col.key)}
                        style={{ textAlign: col.align || 'left', padding: '11px 14px',
                                 borderBottom: '1px solid var(--border)', cursor: 'pointer',
                                 userSelect: 'none', whiteSpace: 'nowrap', background: 'var(--surface)' }}
                        className="transition-colors hover:bg-[var(--hover-bg)]">
                        <span className="inline-flex items-center gap-1"
                          style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                                   letterSpacing: '0.04em',
                                   color: active ? 'var(--text)' : 'var(--text-muted)' }}>
                          {col.label}
                          <SortIcon active={active} dir={sort.dir} />
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => (
                  <tr key={c.id ?? i}
                    onClick={() => setDetail(c)}
                    className="transition-colors hover:bg-[var(--hover-bg)]"
                    style={{ borderBottom: '1px solid var(--hover-bg)', cursor: 'pointer' }}>
                    {columns.map(col => (
                      <td key={col.key}
                        style={{ padding: '10px 14px', textAlign: col.align || 'left',
                                 color: 'var(--text)', fontSize: 13 }}>
                        {col.render(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {detail && (
        <CandidateDetailDrawer candidate={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}