import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import StatusPill from '@/components/ui/StatusPill'
import { formatDT, formatDuration } from '@/components/reports/runFormat'
import { useJobsList } from './useJobsList'
import SearchSelect from '@/components/ui/SearchSelect'
import Button from '@/components/ui/Button'
import { tintBorder } from '@/lib/tint'
import JobsFilterBar from './JobsFilterBar'
import JobsTableFrame from './JobsTableFrame'
import { jobColumns } from './jobColumns'

const STATE_COLOR: Record<string, string> = { pending: 'var(--text-muted)', reserved: 'var(--color-warning)' }

// useJobsList is still a plain .js hook (untyped) — its actual return shape, used to cast below.
interface UseJobsListResult {
  filters: { queue: string; tenant: string; status: string }
  setFilter: (key: string, value: string) => void
  page: number
  setPage: (updater: number | ((p: number) => number)) => void
  result: { rows: PendingJobRow[]; total: number; page: number; lastPage: number }
  phase: 'loading' | 'ready' | 'error'
  cancel: (id: string) => void
  cancelError: { id: string; message: string | null } | null
  setCancelError: (v: null) => void
}

// One row of the pending/reserved backlog table (JobRow + the job-specific extras).
interface PendingJobRow {
  id: string
  queue?: string
  tenant_id?: string
  job?: string
  attempts?: number
  created_at?: string
  reserved_at?: string | null
  runtime_seconds?: number
}

/**
 * JobsTab — Taakbeheer → Taken: the live pending/reserved backlog, filterable by
 * queue/tenant/status, with runtime for jobs currently being executed and a
 * cancel action for jobs that HAVEN'T started yet. A cancel can still race a
 * worker picking the job up between render and click — the resulting 409 is
 * shown inline with the backend's own explanation rather than swallowed.
 */
export default function JobsTab() {
  const { t } = useTranslation('settings')
  const { filters, setFilter, page, setPage, result, phase, cancel, cancelError, setCancelError } = useJobsList() as UseJobsListResult

  // Shared columns (queue, tenant, job) + tab-specific columns.
  const columns = [
    ...jobColumns(t),
    { key: 'attempts', header: t('jobs.col.attempts'), align: 'right' as const },
    { key: 'created_at', header: t('jobs.col.createdAt'), nowrap: true, render: (r: PendingJobRow) => formatDT(r.created_at) },
    { key: 'state', header: t('jobs.col.status'), nowrap: true,
      render: (r: PendingJobRow) => {
        const state = r.reserved_at ? 'reserved' : 'pending'
        return <StatusPill label={t(`jobs.state.${state}`)} color={STATE_COLOR[state]} />
      } },
    { key: 'runtime', header: t('jobs.col.runtime'), align: 'right' as const, nowrap: true,
      render: (r: PendingJobRow) => r.reserved_at ? formatDuration((r.runtime_seconds ?? 0) * 1000) : '—' },
    { key: 'actions', header: t('jobs.col.actions'), align: 'right' as const, nowrap: true,
      render: (r: PendingJobRow) => r.reserved_at ? null : (
        <Button variant="dangerSoft" size="sm" onClick={() => cancel(r.id)}>{t('jobs.cancel')}</Button>
      ) },
  ]

  return (
    <div>
      {/* Filters — queue/tenant are free text (the backend has no enum for either); status is a fixed 2-value set. */}
      <JobsFilterBar filters={filters} setFilter={setFilter} labels={t} />

      {/* Status filter is JobsTab-only. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {/* Herhaal-audit r4 finding 7: SearchSelect's own default trigger face —
            same footprint as RecentJobsTab's tenant filter, so the two compact
            filter triggers in Taakbeheer no longer disagree on height. */}
        <SearchSelect
          options={[
            { value: '', label: t('jobs.filters.all') },
            { value: 'pending', label: t('jobs.state.pending') },
            { value: 'reserved', label: t('jobs.state.reserved') },
          ]}
          selected={[filters.status]}
          onToggle={v => setFilter('status', v)}
          closeOnToggle
          searchable={false}
          triggerLabel={filters.status === 'pending' ? t('jobs.state.pending') : filters.status === 'reserved' ? t('jobs.state.reserved') : t('jobs.filters.all')}
          triggerAriaLabel={t('jobs.filters.status')}
        />
      </div>

      {/* A cancel that lost the race (worker reserved it first) — the 409's own message. */}
      {cancelError && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginBottom: 12,
          borderRadius: 8, background: 'var(--color-warning-bg)', border: tintBorder('var(--color-warning)') }}>
          <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{cancelError.message ?? t('jobs.cancelReservedError')}</span>
          <Button variant="ghost" iconOnly onClick={() => setCancelError(null)} aria-label={t('common.close')}>
            <X size={13} />
          </Button>
        </div>
      )}

      <JobsTableFrame phase={phase} columns={columns} rows={result.rows as PendingJobRow[]} emptyText={t('jobs.empty')} getRowId={(r: PendingJobRow) => r.id} />

      {/* Pagination — server-paginated (max 100/page; we ask for 25). A simple
          prev/next (no page-size picker) doesn't fit the shared PaginationBar's
          fuller contract without also reworking useJobsList's fixed per_page —
          out of this task's scope, so this stays its own minimal pair, now via
          Button (its own disabled recipe replaces the manual opacity/cursor). */}
      {result.lastPage > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('jobs.pagination.prev')}
          </Button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.pagination.page', { page: result.page, last: result.lastPage })}</span>
          <Button variant="secondary" size="sm" disabled={page >= result.lastPage} onClick={() => setPage((p) => p + 1)}>
            {t('jobs.pagination.next')}
          </Button>
        </div>
      )}
    </div>
  )
}
