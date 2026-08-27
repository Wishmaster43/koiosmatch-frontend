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
import { Caption, bodyTextStyle } from '@/components/ui/typography'
import type { RunRow, ReportFilterGroup } from '@/types/reports'

// Pure: read the `workflow_id` param out of a hash string (no window access —
// testable, mirrors useReportSwitch's getViewFromHash). WEBHOOK-RUN-CORRELATION-1:
// a WorkflowRefs link lands here as `#details.runs?workflow_id=<id>`.
// eslint-disable-next-line react-refresh/only-export-components -- a pure helper shared for direct unit testing (mirrors EntityLink's buildEntityDeepLink); HMR-nicety warning only
export function getWorkflowIdFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, '')
  const qIdx = raw.indexOf('?')
  if (qIdx === -1) return null
  return new URLSearchParams(raw.slice(qIdx + 1)).get('workflow_id')
}

// Searchable, filterable workflow-runs list built on the shared DataTable; row
// click opens RunDetailDrawer for the per-step input/output of that execution.
export default function RunsTable() {
  const { t } = useTranslation('reports')
  // WEBHOOK-RUN-CORRELATION-1: a workflow_id arriving via this page's own hash
  // (e.g. a WorkflowRefs link) narrows the request to that workflow's runs. Read
  // once at mount — a fresh navigation here always remounts this table (a page
  // switch, never an in-place hash edit), so a later effect isn't needed.
  const [workflowIdFilter] = useState(() => getWorkflowIdFromHash(window.location.hash))
  // Time window (WEBHOOK-RUN-CORRELATION-1 slotstuk): server-side from/to,
  // inclusive bureau-local day edges (53fe3bb0) — sent only when set.
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const runsUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (workflowIdFilter) params.set('workflow_id', workflowIdFilter)
    if (rangeFrom) params.set('from', rangeFrom)
    if (rangeTo) params.set('to', rangeTo)
    const q = params.toString()
    return q ? `/workflow-runs?${q}` : '/workflow-runs'
  }, [workflowIdFilter, rangeFrom, rangeTo])
  // Data (fetch) lives in the shared hook (§3); this component only derives + renders.
  const { rows, loading } = useReportList<RunRow>(runsUrl)
  // App-wide active locale (§5) — never a hardcoded 'nl-NL' toLocale*String call.
  const { formatDate, formatTime } = useDateFormat()
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState<RunRow | null>(null)
  const [selectedStatuses,   setSelectedStatuses]   = useState<Array<string | number>>([])
  const [selectedWorkflows,  setSelectedWorkflows]  = useState<Array<string | number>>([])

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Distinct workflow names present in the run list, for the "Workflow" filter.
  const workflowOptions = useMemo(() =>
    [...new Set(rows.map(r => r.workflow_name).filter((x): x is string => Boolean(x)))].sort(), [rows])

  // Distinct statuses present in the run list, for the "Status" filter.
  const statusOptions = useMemo(() =>
    [...new Set(rows.map(r => r.status).filter((x): x is string => Boolean(x)))].sort(), [rows])

  // Apply the status/workflow filters and the free-text search over trigger/error fields.
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
          <Caption as="div">{formatTime(r.started_at)}</Caption>
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

  // Build the right-panel filter groups (status + workflow), each option carrying
  // a live count against the unfiltered run list.
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
    // The run window — server-filtered (from/to ride the request), so counts and
    // rows always agree with what the endpoint returns.
    groups.push({
      key: 'runRange', label: t('runs.filters.range'), type: 'date-range',
      from: rangeFrom, to: rangeTo,
      onFromChange: (v: string) => setRangeFrom(v),
      onToChange: (v: string) => setRangeTo(v),
    })
    return groups
  }, [t, statusOptions, workflowOptions, selectedStatuses, selectedWorkflows, rows, rangeFrom, rangeTo])

  // Publish the current filter groups into the shared right panel; unregister on
  // unmount/change so a stale group set never lingers there.
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
          {/* bodyTextStyle spread (not a hand-picked fontSize/color pair): a native
              <input> can't wrap the BodyText atom, so its typography rides the same
              raw identity via spread — see typography.tsx's own style-object note. */}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('runs.search')} aria-label={t('runs.search')}
            style={{ ...bodyTextStyle, height: 34, width: 260, paddingLeft: 32, paddingRight: 12,
                     border: '1px solid var(--border)', borderRadius: 8, outline: 'none' }} />
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
