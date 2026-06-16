/**
 * CandidatesTable — searchable, sortable table of candidates.
 * Shows a status badge per candidate; clicking a row opens CandidateDetailDrawer.
 * Filters come from RightPanelContext. StatusBadge below = the colored status pill.
 */
import { useState, useEffect, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, RefreshCw } from 'lucide-react'
import CandidateDetailDrawer from './CandidateDetailDrawer'
import { useRightPanel }     from '../../context/RightPanelContext'

// Colored status pill (actief / nietactief / extern / ...) for a candidate row.
function StatusBadge({ status }) {
  const styles = {
    actief:     { bg: '#F0FDF4', color: '#16A34A' },
    nietactief: { bg: '#FFF7ED', color: '#C2410C' },
    extern:     { bg: '#EFF6FF', color: '#1D4ED8' },
    intake:     { bg: '#FAF5FF', color: '#7C3AED' },
    verwijderd: { bg: '#FEF2F2', color: '#DC2626' },
  }
  const key = (status || '').toLowerCase().replace(/\s+/g, '')
  const s = styles[key] || { bg: '#F9FAFB', color: '#6B7280' }
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500,
                   padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {status || 'onbekend'}
    </span>
  )
}

function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TagPill({ value, color = '#534AB7', bg = '#EEF2FF' }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 5,
                   background: bg, color, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

function TagCell({ items, color, bg }) {
  if (!items?.length) return <span style={{ color: '#D1D5DB' }}>—</span>
  const visible = items.slice(0, 2)
  const rest    = items.length - 2
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((v, i) => <TagPill key={i} value={v} color={color} bg={bg} />)}
      {rest > 0 && <TagPill value={`+${rest}`} color="#6B7280" bg="#F3F4F6" />}
    </div>
  )
}

function RateCell({ candidate }) {
  const rates = candidate.global_rate_summary
  if (!Array.isArray(rates) || !rates.length) return <span style={{ color: '#D1D5DB' }}>—</span>
  const visible = rates.slice(0, 2)
  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((r, i) => (
        <span key={i} style={{ fontSize: 11, color: '#374151', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#9CA3AF' }}>
            {r.global_rate?.internal_description ?? r.step_name ?? '—'}:&nbsp;
          </span>
          {r.hour_rate != null ? `€${Number(r.hour_rate).toFixed(2)}` : '—'}
        </span>
      ))}
      {rates.length > 2 && (
        <span style={{ fontSize: 10, color: '#9CA3AF' }}>+{rates.length - 2} meer</span>
      )}
    </div>
  )
}

function parseKenmerken(v) {
  if (!Array.isArray(v)) return []
  return v.map(item => item.name ?? String(item)).filter(Boolean)
}

const COLUMNS = [
  { key: 'name', label: 'Naam', type: 'string',
    value: c => `${c.firstname ?? ''} ${c.lastname ?? ''}`.trim(),
    render: c => (
      <div>
        <div style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>
          {`${c.firstname ?? ''} ${c.lastname ?? ''}`.trim() || '—'}
        </div>
        {c.email && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{c.email}</div>}
      </div>
    )},
  { key: 'status', label: 'Status', type: 'string',
    value: c => c.status || '',
    render: c => <StatusBadge status={c.status} /> },
  { key: 'position', label: 'Functie', type: 'string',
    value: c => c.position || '',
    render: c => <span style={{ fontSize: 13 }}>{c.position || '—'}</span> },
  { key: 'mobile', label: 'Mobiel', type: 'string',
    value: c => c.mobile ?? c.phone ?? '',
    render: c => <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{c.mobile ?? c.phone ?? '—'}</span> },
  { key: 'registration_date', label: 'Registratie', type: 'date',
    value: c => c.registration_date || null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.registration_date)}</span> },
  { key: 'last_login_at', label: 'Laatste inlog', type: 'date',
    value: c => c.last_login_at || null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.last_login_at)}</span> },
  { key: 'last_planned_shift', label: 'Geplande dienst', type: 'date',
    value: c => c.last_planned_shift || null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.last_planned_shift)}</span> },
  { key: 'last_worked_shift', label: 'Laatste dienst', type: 'date',
    value: c => c.last_worked_shift || null,
    render: c => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(c.last_worked_shift)}</span> },
  { key: 'number_of_times_worked', label: 'Diensten', type: 'number', align: 'right',
    value: c => Number(c.number_of_times_worked) || 0,
    render: c => <span style={{ fontSize: 13 }}>{c.number_of_times_worked ?? 0}</span> },
  { key: 'features', label: 'Kenmerken', type: 'string',
    value: c => parseKenmerken(c.features).join(', '),
    render: c => <TagCell items={parseKenmerken(c.features)} color="#534AB7" bg="#EEF2FF" /> },
  { key: 'global_rate', label: 'Globale rates', type: 'string',
    value: c => '',
    render: c => <RateCell candidate={c} /> },
]

function compareValues(a, b, col, dir) {
  const av = col.value(a)
  const bv = col.value(b)
  const aE = av === null || av === undefined || av === ''
  const bE = bv === null || bv === undefined || bv === ''
  if (aE && bE) return 0
  if (aE) return 1
  if (bE) return -1
  let cmp
  if (col.type === 'number')    cmp = av - bv
  else if (col.type === 'date') cmp = new Date(av).getTime() - new Date(bv).getTime()
  else                          cmp = String(av).localeCompare(String(bv), 'nl', { sensitivity: 'base' })
  return dir === 'asc' ? cmp : -cmp
}

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown size={11} style={{ color: '#D1D5DB' }} />
  return dir === 'asc'
    ? <ChevronUp size={11} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={11} style={{ color: 'var(--color-primary)' }} />
}

export default function CandidatesTable({ candidates = [], loading = false }) {
  const [search, setSearch]                       = useState('')
  const { registerFilters, unregisterFilters }    = useRightPanel()
  const [selectedYears, setSelectedYears]         = useState([])
  const [selectedStatuses, setSelectedStatuses]   = useState(['actief'])
  const [selectedPositions, setSelectedPositions] = useState([])
  const [selectedKenmerken, setSelectedKenmerken] = useState([])
  const [sort, setSort]                           = useState({ key: 'name', dir: 'asc' })
  const [detail, setDetail]                       = useState(null)

  const toggle = setter => value =>
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])

  const statusOptions = useMemo(() =>
    [...new Set(candidates.map(c => c.status).filter(Boolean))].sort(), [candidates])

  const positionOptions = useMemo(() =>
    [...new Set(candidates.map(c => c.position).filter(Boolean))].sort(), [candidates])

  const yearOptions = useMemo(() => {
    const ys = candidates
      .map(c => c.registration_date ? new Date(c.registration_date).getFullYear() : null)
      .filter(y => y && !isNaN(y))
    return [...new Set(ys)].sort((a, b) => b - a)
  }, [candidates])

  const kenmerkOptions = useMemo(() => {
    const all = candidates.flatMap(c =>
      Array.isArray(c.features) ? c.features.map(f => f.name).filter(Boolean) : []
    )
    return [...new Set(all)].sort()
  }, [candidates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates.filter(c => {
      if (selectedStatuses.length  && !selectedStatuses.includes(c.status))    return false
      if (selectedPositions.length && !selectedPositions.includes(c.position)) return false
      if (selectedYears.length) {
        const y = c.registration_date ? new Date(c.registration_date).getFullYear() : null
        if (!selectedYears.includes(y)) return false
      }
      if (selectedKenmerken.length) {
        const cKenmerken = parseKenmerken(c.features)
        if (!selectedKenmerken.some(k => cKenmerken.includes(k))) return false
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
    const col = COLUMNS.find(c => c.key === sort.key)
    if (!col) return filtered
    return [...filtered].sort((a, b) => compareValues(a, b, col, sort.dir))
  }, [filtered, sort])

  const onSort = key =>
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })

  const filterGroups = useMemo(() => [
    { key: 'jaar', label: 'Registratiejaar',
      options: yearOptions.map(y => ({ value: y, label: String(y) })),
      selected: selectedYears, onToggle: toggle(setSelectedYears) },
    { key: 'status', label: 'Status',
      options: statusOptions.map(s => ({ value: s, label: s })),
      selected: selectedStatuses, onToggle: toggle(setSelectedStatuses) },
    { key: 'functie', label: 'Functie',
      options: positionOptions.map(p => ({ value: p, label: p })),
      selected: selectedPositions, onToggle: toggle(setSelectedPositions) },
    { key: 'kenmerken', label: 'Kenmerken',
      options: kenmerkOptions.map(k => ({ value: k, label: k })),
      selected: selectedKenmerken, onToggle: toggle(setSelectedKenmerken) },
  ], [yearOptions, statusOptions, positionOptions, kenmerkOptions,
      selectedYears, selectedStatuses, selectedPositions, selectedKenmerken])

  useEffect(() => {
    registerFilters('candidates-table', filterGroups)
    return () => unregisterFilters('candidates-table')
  }, [filterGroups, registerFilters, unregisterFilters])


  return (
    <div className="flex flex-col h-full">

      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Details — Kandidaten</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
            {filtered.length} van {candidates.length} kandidaten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                       transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Zoeken op naam, e-mail, functie..."
              style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                       border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#374151' }} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-white rounded-xl"
        style={{ border: '1px solid #F3F4F6' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3"
              style={{ height: '100%', minHeight: 300 }}>
              <RefreshCw size={20} className="animate-spin" style={{ color: '#D1D5DB' }} />
              <p className="text-sm text-gray-400">Kandidaten ophalen...</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center"
              style={{ height: '100%', minHeight: 300 }}>
              <p className="text-sm font-medium text-gray-400">Geen kandidaten gevonden</p>
              <p className="text-xs text-gray-300">Pas de filters of zoekopdracht aan</p>
            </div>
          ) : (
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 1, background: '#fff' }}>
                  {COLUMNS.map(col => {
                    const active = sort.key === col.key
                    return (
                      <th key={col.key} onClick={() => onSort(col.key)}
                        style={{ textAlign: col.align || 'left', padding: '11px 14px',
                                 borderBottom: '1px solid #F3F4F6', cursor: 'pointer',
                                 userSelect: 'none', whiteSpace: 'nowrap', background: '#fff' }}
                        className="transition-colors hover:bg-gray-50">
                        <span className="inline-flex items-center gap-1"
                          style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                                   letterSpacing: '0.04em',
                                   color: active ? '#374151' : '#9CA3AF' }}>
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
                    className="transition-colors hover:bg-gray-50"
                    style={{ borderBottom: '1px solid #F9FAFB', cursor: 'pointer' }}>
                    {COLUMNS.map(col => (
                      <td key={col.key}
                        style={{ padding: '10px 14px', textAlign: col.align || 'left',
                                 color: '#374151', fontSize: 13 }}>
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