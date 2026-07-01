/**
 * RunsTable — searchable, sortable table of workflow runs (executions).
 * Shows each run's workflow, status, start time, duration and processed count;
 * filters come from RightPanelContext. The row drill-down (run meta + per-step
 * INPUT/OUTPUT) is the shared RunDetailDrawer.
 */
import { useState, useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Zap } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useReportList } from './useReportList'
import { formatDuration, StatusBadge } from './runFormat'
import RunDetailDrawer from './RunDetailDrawer'
import type { RunRow, ReportFilterGroup, SortState } from '@/types/reports'

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={12} style={{ color: 'var(--border)' }} />
  return dir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--color-primary)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--color-primary)' }} />
}

// ─── Tabel ────────────────────────────────────────────────────────────────────

const TH: CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600,
             color: 'var(--text-muted)', background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)',
             whiteSpace: 'nowrap', userSelect: 'none' }
const TD: CSSProperties = { padding: '10px 12px', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)' }

const COL_KEYS = [
  { key: 'started_at',       tKey: 'started',    sortable: true  },
  { key: 'workflow_name',    tKey: 'workflow',   sortable: true  },
  { key: 'status',           tKey: 'status',     sortable: true  },
  { key: 'candidates_count', tKey: 'candidates', sortable: true  },
  { key: 'duration_ms',      tKey: 'duration',   sortable: true  },
  { key: 'trigger',          tKey: 'trigger',    sortable: false },
]

export default function RunsTable() {
  const { t } = useTranslation('reports')
  const COLS = COL_KEYS.map(c => ({ ...c, label: t(`runs.cols.${c.tKey}`) }))
  // Data (fetch) lives in the shared hook (§3); this component only derives + renders.
  const { rows, loading } = useReportList<RunRow>('/workflow-runs')
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState<RunRow | null>(null)
  const [sort,    setSort]    = useState<SortState>({ key: 'started_at', dir: 'desc' })
  const [selectedStatuses,   setSelectedStatuses]   = useState<Array<string | number>>([])
  const [selectedWorkflows,  setSelectedWorkflows]  = useState<Array<string | number>>([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  const workflowOptions = useMemo(() =>
    [...new Set(rows.map(r => r.workflow_name).filter((x): x is string => Boolean(x)))].sort(), [rows])

  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.status).filter((x): x is string => Boolean(x)))].sort(), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (selectedStatuses.length  && !selectedStatuses.includes(r.status as string))        return false
      if (selectedWorkflows.length && !selectedWorkflows.includes(r.workflow_name as string)) return false
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
      if ((av as number) < (bv as number)) return dir === 'asc' ? -1 : 1
      if ((av as number) > (bv as number)) return dir === 'asc' ?  1 : -1
      return 0
    })
  }, [filtered, sort])

  const setSort_ = (key: string) => setSort(prev =>
    prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  const filterGroups = useMemo(() => {
    const groups: ReportFilterGroup[] = []
    if (statusOptions.length) {
      groups.push({
        key: 'status', label: t('runs.filters.status'),
        selected: selectedStatuses,
        options: statusOptions.map(s => ({
          value: s,
          label: t(`runs.status.${s}`, { defaultValue: s }),
          count: rows.filter(r => r.status === s).length,
        })),
        onToggle: v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    if (workflowOptions.length) {
      groups.push({
        key: 'workflow', label: t('runs.filters.workflow'), type: 'search-select',
        selected: selectedWorkflows,
        options: workflowOptions.map(w => ({
          value: w, label: w,
          count: rows.filter(r => r.workflow_name === w).length,
        })),
        onToggle: v => setSelectedWorkflows(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]),
      })
    }
    return groups
  }, [t, statusOptions, workflowOptions, selectedStatuses, selectedWorkflows, rows])

  useEffect(() => {
    registerFilters('runs-table', filterGroups)
    return () => unregisterFilters('runs-table')
  }, [filterGroups, registerFilters, unregisterFilters])

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>{t('runs.title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {loading ? t('common.loadingShort') : t('runs.summary', { shown: filtered.length, total: rows.length })}
          </p>
        </div>
        <div className="relative">
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%',
                                     transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('runs.search')} aria-label={t('runs.search')}
            style={{ height: 34, width: 260, paddingLeft: 32, paddingRight: 12, fontSize: 13,
                     border: '1px solid var(--border)', borderRadius: 8, outline: 'none', color: 'var(--text)' }} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-[var(--surface)] rounded-xl"
        style={{ border: '1px solid var(--border)' }}>
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
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t('runs.loading')}
                </td></tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={COLS.length} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {t('runs.empty')}
                </td></tr>
              )}
              {!loading && sorted.map((r, i) => (
                  <tr key={r.id ?? i}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDrill(r)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...TD, fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                        {r.started_at ? new Date(r.started_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {r.started_at ? new Date(r.started_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                    <td style={{ ...TD, fontWeight: 500, color: 'var(--text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={13} color="var(--color-primary)" />
                        {r.workflow_name ?? t('runs.drawer.workflowFallback', { id: r.workflow_id ?? r.id })}
                      </div>
                    </td>
                    <td style={TD}><StatusBadge status={r.status} /></td>
                    <td style={{ ...TD, fontWeight: 500 }}>
                      {r.candidates_count ?? r.candidates ?? <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>
                    <td style={{ ...TD, fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDuration(r.duration_ms ?? r.duration)}
                    </td>
                    <td style={{ ...TD, fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.trigger ?? r.trigger_type ?? <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {drill && <RunDetailDrawer run={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
