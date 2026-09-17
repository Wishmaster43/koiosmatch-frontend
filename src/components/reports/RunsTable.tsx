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
import { Zap } from 'lucide-react'
import { useRightPanel } from '@/context/RightPanelContext'
import { useDateFormat } from '@/lib/datetime'
import DataTable from '../ui/DataTable'
import type { Column } from '../ui/DataTable'
import { useReportList } from './useReportList'
import { resolveWorkflowBaseURL } from '@/lib/workflowApi'
import { formatDuration, StatusBadge } from './runFormat'
import { blockedReason } from './blockedReason'
import RunDetailDrawer from './RunDetailDrawer'
import { buildStatusGroup, buildWorkflowGroup } from './reportFilterDefs'
import { distinctSortedValues } from './distinctSortedValues'
import { Caption } from '@/components/ui/typography'
import { ReportTableToolbar } from './reportTableChrome'
import type { RunRow, ReportFilterGroup } from '@/types/reports'

// Display status → backend enum (WFB-14): RunPresenter maps its 'completed'
// column value to the display string 'success' before it ever reaches the FE,
// so forwarding the displayed value as-is would 422 against the API's `in:`
// rule. Every other display status already matches its API value verbatim.
const STATUS_DISPLAY_TO_API: Record<string, string> = { success: 'completed' }

// WFB-14 (c): the FIXED run-status vocabulary, never the statuses present on
// the current page. Deriving the filter's options from `rows` traps the
// filter: picking "failed" in a window with no failed run makes the server
// return zero rows, which would empty `statusOptions`, unregister the status
// group entirely, and leave the stale `selectedStatuses` riding every later
// request with no UI left to clear it. A fixed list can never disappear.
// LIMITS-FE-F7: 'blocked' (a run halted by a connector limit) joins the
// vocabulary — it is a real terminal value on WorkflowRun::STATUSES (backend).
const RUN_STATUS_VALUES = ['success', 'failed', 'running', 'waiting', 'cancelled', 'blocked']

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
  const [selectedStatuses,   setSelectedStatuses]   = useState<Array<string | number>>([])
  const [selectedWorkflows,  setSelectedWorkflows]  = useState<Array<string | number>>([])
  const runsUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (workflowIdFilter) params.set('workflow_id', workflowIdFilter)
    if (rangeFrom) params.set('from', rangeFrom)
    if (rangeTo) params.set('to', rangeTo)
    // WFB-14: a single status selection is sent server-side (through the
    // display→API map) rather than only ever filtering the fetched page.
    // Multiple statuses at once stay a client-side refinement over the
    // unfiltered page — the endpoint's `status` param is single-valued.
    if (selectedStatuses.length === 1) {
      const display = String(selectedStatuses[0])
      params.set('status', STATUS_DISPLAY_TO_API[display] ?? display)
    }
    const q = params.toString()
    return q ? `/workflow-runs?${q}` : '/workflow-runs'
  }, [workflowIdFilter, rangeFrom, rangeTo, selectedStatuses])
  // Data (fetch) lives in the shared hook (§3); this component only derives + renders.
  const { rows, loading, error } = useReportList<RunRow>(runsUrl, resolveWorkflowBaseURL())
  // App-wide active locale (§5) — never a hardcoded 'nl-NL' toLocale*String call.
  const { formatDate, formatTime } = useDateFormat()
  const [search,  setSearch]  = useState('')
  const [drill,   setDrill]   = useState<RunRow | null>(null)

  const { registerFilters, unregisterFilters } = useRightPanel()

  // Distinct workflow names present in the run list, for the "Workflow" filter.
  const workflowOptions = useMemo(() => distinctSortedValues(rows, r => r.workflow_name), [rows])

  // WFB-14 (c): the "Status" filter's OPTIONS are the fixed vocabulary above,
  // not whatever happens to be on the currently loaded page (see the comment
  // on RUN_STATUS_VALUES) — the group always registers with all six choices.
  const statusOptions = RUN_STATUS_VALUES

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
      // F7: the badge's own title/sr-only text carries the block reason on a
      // blocked run — read from the capped step, not the still-empty error_message.
      render: r => <StatusBadge status={r.status} reason={blockedReason(r)} />,
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
    // Fixed vocabulary (see RUN_STATUS_VALUES) — this group always registers.
    groups.push(buildStatusGroup(t, statusOptions, selectedStatuses, rows, 'runs.filters.status',
      v => setSelectedStatuses(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])))
    if (workflowOptions.length) {
      groups.push(buildWorkflowGroup(t, workflowOptions, selectedWorkflows, rows, 'runs.filters.workflow',
        v => setSelectedWorkflows(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])))
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

      {/* Header — shared ReportTableToolbar (D1 audit fix), same as every other
          report table in this folder instead of a hand-duplicated title+search box. */}
      <ReportTableToolbar
        title={t('runs.title')}
        summary={loading ? t('common.loadingShort') : t('runs.summary', { shown: filtered.length, total: rows.length })}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('runs.search')}
      />

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
            // A failed load is an ERROR state, not "no runs yet" (audit r2-ui-states-2).
            emptyText={error ? t('runs.loadError') : t('runs.empty')}
            defaultSort={{ key: 'started_at', dir: 'desc' }}
          />
        </div>
      </div>

      {drill && <RunDetailDrawer run={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}
