/**
 * RunsTable — searchable, sortable table of workflow runs (executions).
 * Shows each run's workflow, status, start time, duration and processed count;
 * filters come from RightPanelContext. The row drill-down (run meta + per-step
 * INPUT/OUTPUT) is the shared RunDetailDrawer.
 *
 * Uses the shared DataTable (§3A) so its sortable headers get real keyboard
 * reachability + aria-sort for free — this table has no pagination and no
 * grouped/totals rows, so it fits DataTable's contract without losing anything
 * (accessibility audit 2026-07-28).
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Zap } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useDateFormat } from '@/lib/datetime'
import DataTable from '../ui/DataTable'
import type { Column } from '../ui/DataTable'
import { useReportList } from './useReportList'
import { formatDuration, StatusBadge } from './runFormat'
import RunDetailDrawer from './RunDetailDrawer'
import type { RunRow, ReportFilterGroup } from '@/types/reports'

export default function RunsTable() {
  const { t } = useTranslation('reports')
  // Data (fetch) lives in the shared hook (§3); this component only derives + renders.
  const { rows, loading } = useReportList<RunRow>('/workflow-runs')
  // App-wide active locale (§5) — never a hardcoded 'nl-NL' toLocale*String call.
  const { formatDate, formatTime } = useDateFormat()
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState<RunRow | null>(null)
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

  // Fallback row id: an object-identity map onto the ORIGINAL fetched list so a
  // run without an `id` (defensive — real API rows always carry one) still gets
  // a stable key, mirroring the old `r.id ?? i` fallback without needing an index.
  const idIndex = useMemo(() => new Map(rows.map((r, i) => [r, i])), [rows])
  const getRowId = (r: RunRow) => r.id ?? idIndex.get(r) ?? 0

  // Column definitions handed to the shared DataTable — sorting/aria-sort/keyboard
  // reach live there (§3A); this component only declares columns + cell rendering.
  const columns: Column<RunRow>[] = useMemo(() => [
    {
      key: 'started_at', header: t('runs.cols.started'), sortable: true,
      sortValue: r => r.started_at ? new Date(r.started_at).getTime() : null,
      render: r => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{formatDate(r.started_at)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(r.started_at)}</div>
        </div>
      ),
    },
    {
      key: 'workflow_name', header: t('runs.cols.workflow'), sortable: true,
      sortValue: r => r.workflow_name ?? null,
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: 'var(--text)' }}>
          <Zap size={13} color="var(--color-primary)" />
          {r.workflow_name ?? t('runs.drawer.workflowFallback', { id: r.workflow_id ?? r.id })}
        </div>
      ),
    },
    {
      key: 'status', header: t('runs.cols.status'), sortable: true,
      sortValue: r => r.status ?? null,
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'candidates_count', header: t('runs.cols.candidates'), sortable: true,
      sortValue: r => r.candidates_count ?? r.candidates ?? null,
      render: r => r.candidates_count ?? r.candidates ?? <span style={{ color: 'var(--border)' }}>—</span>,
    },
    {
      key: 'duration_ms', header: t('runs.cols.duration'), sortable: true,
      sortValue: r => r.duration_ms ?? r.duration ?? null,
      render: r => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDuration(r.duration_ms ?? r.duration)}</span>,
    },
    {
      key: 'trigger', header: t('runs.cols.trigger'),
      render: r => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.trigger ?? r.trigger_type ?? <span style={{ color: 'var(--border)' }}>—</span>}</span>,
    },
  ], [t, formatDate, formatTime])

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
          <DataTable
            columns={columns}
            rows={filtered}
            getRowId={getRowId}
            onRowClick={setDrill}
            loading={loading}
            loadingText={t('runs.loading')}
            emptyText={t('runs.empty')}
            defaultSort={{ key: 'started_at', dir: 'desc' }}
          />
        </div>
      </div>

      {drill && <RunDetailDrawer run={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
