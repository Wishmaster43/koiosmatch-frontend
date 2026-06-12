import { useState, useEffect, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, X,
         Zap, CheckCircle, XCircle, Clock, Users, AlertTriangle, RotateCcw } from 'lucide-react'
import { useRightPanel } from '../../context/RightPanelContext'
import api from '../../lib/api'

const PAD = n => String(n).padStart(2, '0')

function formatDT(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return `${PAD(d.getDate())}-${PAD(d.getMonth()+1)}-${d.getFullYear()} ${PAD(d.getHours())}:${PAD(d.getMinutes())}`
}

function formatDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`
  return `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`
}

const STATUS_META = {
  success:  { label: 'Geslaagd',    bg: '#F0FDF4', color: '#16A34A', Icon: CheckCircle },
  failed:   { label: 'Mislukt',     bg: '#FEF2F2', color: '#DC2626', Icon: XCircle     },
  running:  { label: 'Bezig',       bg: '#FFFBEB', color: '#D97706', Icon: RotateCcw   },
  pending:  { label: 'In wachtrij', bg: '#F9FAFB', color: '#6B7280', Icon: Clock       },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status ?? '—', bg: '#F9FAFB', color: '#6B7280', Icon: Clock }
  const Icon = m.Icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: m.bg, color: m.color,
                   fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      <Icon size={10} />
      {m.label}
    </span>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown size={12} style={{ color: '#D1D5DB' }} />
  return dir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />
}

// ─── Drill-down drawer ────────────────────────────────────────────────────────

function RunDrawer({ run, onClose }) {
  const m = STATUS_META[run.status] ?? { label: run.status ?? '—', bg: '#F9FAFB', color: '#6B7280', Icon: Clock }
  const Icon = m.Icon

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-white"
        style={{ width: 500, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Zap size={15} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                  {run.workflow_name ?? `Workflow #${run.workflow_id ?? run.id}`}
                </span>
                <StatusBadge status={run.status} />
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                Gestart: {formatDT(run.started_at ?? run.created_at)}
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                       borderRadius: 6, marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', gap: 1, background: '#F9FAFB',
                      borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          {[
            { label: 'Kandidaten',   value: run.candidates_count ?? run.candidates ?? '—', Icon: Users },
            { label: 'Duur',         value: formatDuration(run.duration_ms ?? run.duration), Icon: Clock },
          ].map(b => (
            <div key={b.label} style={{ flex: 1, padding: '10px 16px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <b.Icon size={12} color="#9CA3AF" />
                <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{b.value}</span>
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{b.label}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* Tijdlijn */}
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginBottom: 10 }}>
            Tijdlijn
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
            {[
              { label: 'Gestart',   value: formatDT(run.started_at  ?? run.created_at) },
              { label: 'Afgerond',  value: formatDT(run.finished_at ?? run.completed_at) },
              { label: 'Trigger',   value: run.trigger ?? run.trigger_type },
              { label: 'Aangemaakt door', value: run.triggered_by ?? run.user_name },
            ].filter(r => r.value && r.value !== '—').map(r => (
              <div key={r.label} style={{ display: 'flex', gap: 8, padding: '7px 0',
                                          borderBottom: '1px solid #F9FAFB' }}>
                <span style={{ fontSize: 12, color: '#9CA3AF', width: 140, flexShrink: 0 }}>{r.label}</span>
                <span style={{ fontSize: 12, color: '#374151' }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Stap-resultaten */}
          {(run.step_results ?? run.steps ?? []).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase',
                            letterSpacing: '0.05em', marginBottom: 10 }}>
                Stap-resultaten ({(run.step_results ?? run.steps).length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {(run.step_results ?? run.steps).map((step, i) => (
                  <div key={i} style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  marginBottom: step.message ? 4 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                        {step.label ?? step.type ?? `Stap ${i + 1}`}
                      </span>
                      <StatusBadge status={step.status ?? (step.ok ? 'success' : 'failed')} />
                    </div>
                    {step.message && (
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{step.message}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Foutmelding */}
          {run.error_message && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8,
                          padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AlertTriangle size={13} color="#DC2626" />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>Foutmelding</span>
              </div>
              <pre style={{ fontSize: 11, color: '#374151', whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all', margin: 0, fontFamily: 'monospace' }}>
                {run.error_message}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Tabel ────────────────────────────────────────────────────────────────────

const TH = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
             color: '#9CA3AF', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
             whiteSpace: 'nowrap', userSelect: 'none' }
const TD = { padding: '10px 12px', fontSize: 13, color: '#374151', borderBottom: '1px solid #F9FAFB' }

const COLS = [
  { key: 'started_at',      label: 'Gestart',     sortable: true  },
  { key: 'workflow_name',   label: 'Workflow',     sortable: true  },
  { key: 'status',          label: 'Status',       sortable: true  },
  { key: 'candidates_count', label: 'Kandidaten',  sortable: true  },
  { key: 'duration_ms',     label: 'Duur',         sortable: true  },
  { key: 'trigger',         label: 'Trigger',      sortable: false },
]

export default function RunsTable() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState(null)
  const [sort,    setSort]    = useState({ key: 'started_at', dir: 'desc' })
  const [selectedStatuses,   setSelectedStatuses]   = useState([])
  const [selectedWorkflows,  setSelectedWorkflows]  = useState([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    api.get('/workflow-runs')
      .then(res => setRows(res.data?.data ?? res.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const workflowOptions = useMemo(() =>
    [...new Set(rows.map(r => r.workflow_name).filter(Boolean))].sort(), [rows])

  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.status).filter(Boolean))].sort(), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (selectedStatuses.length  && !selectedStatuses.includes(r.status))        return false
      if (selectedWorkflows.length && !selectedWorkflows.includes(r.workflow_name)) return false
      if (!q) return true
      return (
        (r.workflow_name  ?? '').toLowerCase().includes(q) ||
        (r.trigger        ?? '').toLowerCase().includes(q) ||
        (r.triggered_by   ?? '').toLowerCase().includes(q) ||
        (r.error_message  ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, selectedStatuses, selectedWorkflows])

  const sorted = useMemo(() => {
    const { key, dir } = sort
    return [...filtered].sort((a, b) => {
      const av = key === 'candidates_count' || key === 'duration_ms'
        ? (a[key] ?? 0)
        : (a[key] ?? '').toString().toLowerCase()
      const bv = key === 'candidates_count' || key === 'duration_ms'
        ? (b[key] ?? 0)
        : (b[key] ?? '').toString().toLowerCase()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ?  1 : -1
      return 0
    })
  }, [filtered, sort])

  const setSort_ = key => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  const filterGroups = useMemo(() => {
    const groups = []
    if (statusOptions.length) {
      groups.push({
        key: 'status', label: 'Status',
        selected: selectedStatuses,
        options: statusOptions.map(s => ({
          value: s,
          label: STATUS_META[s]?.label ?? s,
          count: rows.filter(r => r.status === s).length,
        })),
        onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    if (workflowOptions.length) {
      groups.push({
        key: 'workflow', label: 'Workflow', type: 'search-select',
        selected: selectedWorkflows,
        options: workflowOptions.map(w => ({
          value: w, label: w,
          count: rows.filter(r => r.workflow_name === w).length,
        })),
        onToggle: v => setSelectedWorkflows(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    return groups
  }, [statusOptions, workflowOptions, selectedStatuses, selectedWorkflows, rows])

  useEffect(() => {
    registerFilters('runs-table', filterGroups)
    return () => unregisterFilters('runs-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Details — Uitvoeringen</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
            {loading ? 'Laden…' : `${filtered.length} van ${rows.length} uitvoeringen`}
          </p>
        </div>
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                     transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Zoek op workflow, trigger, fout…"
            style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                     border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none', color: '#374151' }} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-white rounded-xl"
        style={{ border: '1px solid #F3F4F6' }}>
        <div className="flex-1 min-w-0 overflow-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {COLS.map(col => (
                  <th key={col.key} style={TH} onClick={() => col.sortable && setSort_(col.key)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                                  cursor: col.sortable ? 'pointer' : 'default' }}>
                      {col.label}
                      {col.sortable && <SortIcon active={sort.key === col.key} dir={sort.dir} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                  Uitvoeringen ophalen…
                </td></tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                  Geen uitvoeringen gevonden
                </td></tr>
              )}
              {!loading && sorted.map((r, i) => (
                  <tr key={r.id ?? i}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrill(r)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>
                        {r.started_at ? new Date(r.started_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {r.started_at ? new Date(r.started_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                    <td style={{ ...TD, fontWeight: 500, color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={13} color="var(--color-primary)" />
                        {r.workflow_name ?? `Workflow #${r.workflow_id ?? r.id}`}
                      </div>
                    </td>
                    <td style={TD}><StatusBadge status={r.status} /></td>
                    <td style={{ ...TD, fontWeight: 500 }}>
                      {r.candidates_count ?? r.candidates ?? <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ ...TD, fontSize: 12, color: '#6B7280' }}>
                      {formatDuration(r.duration_ms ?? r.duration)}
                    </td>
                    <td style={{ ...TD, fontSize: 12, color: '#6B7280' }}>
                      {r.trigger ?? r.trigger_type ?? <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {drill && <RunDrawer run={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
