/**
 * FailedJobsTab — Taakbeheer → Mislukt: the failure log with per-row retry/forget
 * and the two bulk interventions (retry-all, flush). Both bulk actions are
 * destructive/irreversible, so each is gated behind the shared ConfirmDialog naming
 * the exact count — mirrors the confirm pattern used for API-key/webhook delete
 * elsewhere in Settings.
 */
import { useTranslation } from 'react-i18next'
import { RefreshCw, Trash2, X } from 'lucide-react'
import { formatDT } from '@/components/reports/runFormat'
import { useConfirm } from '@/hooks/useConfirm'
import { useFailedJobs } from './useFailedJobs'
import Button from '@/components/ui/Button'
import { Mono } from '@/components/ui/typography'
import { tintBorder } from '@/lib/tint'
import { notify } from '@/lib/notify'
import JobsFilterBar from './JobsFilterBar'
import JobsTableFrame from './JobsTableFrame'
import { jobColumns, type JobRow } from './jobColumns'
import type { Column } from '@/components/ui/DataTable'

// One row of the failed-jobs list — hand-written: useFailedJobs (still .js) carries
// no exported row type, and the spec has no 2xx schema for GET /admin/jobs/failed.
// Extends JobRow so it also satisfies the shared queue/tenant/job columns.
interface FailedJobRow extends JobRow {
  uuid: string
  workflow?: string | null
  requested_by?: string | null
  subject?: { type: string; reference: string } | null
  exception_summary?: string
  failed_at?: string
}

// Failure log with per-row retry/forget and two destructive bulk actions, both gated behind the shared confirm dialog naming the exact count (see file header).
export default function FailedJobsTab() {
  const { t } = useTranslation('settings')
  const {
    filters, setFilter, page, setPage, result, phase,
    retry, forget, retryAll, flush, busyId, bulkBusy, actionError, setActionError,
    truncated,
  } = useFailedJobs()
  const { confirm, dialog } = useConfirm()

  // Retry-all: one toast with the count, plus the skipped (dead tenant) and
  // truncated (more failures than one pass covers) notes when the server reports them.
  const runRetryAll = async () => {
    const r = await retryAll()
    if (!r) return
    const parts = [t('jobs.retryAllSuccess', { count: r.count })]
    if (r.skipped.length > 0) parts.push(t('jobs.retryAllSkipped', { count: r.skipped.length }))
    if (r.truncated) parts.push(t('jobs.retryAllTruncated'))
    notify('success', parts.join(' · '))
  }

  // Determine the confirmation key based on which filters are active (X-41).
  // The dialog message must match the action's actual scope.
  const getConfirmKey = (baseKey: string): string => {
    const hasQueue = Boolean(filters.queue)
    const hasTenant = Boolean(filters.tenant)

    if (hasQueue && hasTenant) return `${baseKey}QueueTenantConfirm`
    if (hasQueue) return `${baseKey}QueueConfirm`
    if (hasTenant) return `${baseKey}TenantConfirm`
    return `${baseKey}Confirm`
  }

  // Bulk actions are irreversible — confirm with the exact scope before firing.
  const confirmRetryAll = () => {
    const key = getConfirmKey('jobs.retryAll')
    const opts: Record<string, unknown> = { count: result.total }
    if (filters.queue) opts.queue = filters.queue
    if (filters.tenant) opts.tenant = filters.tenant
    confirm(t(key, opts), runRetryAll)
  }

  // Confirm flush with the exact scope — the queue/tenant params are sent to the API.
  const confirmFlush = () => {
    const key = getConfirmKey('jobs.flush')
    const opts: Record<string, unknown> = { count: result.total }
    if (filters.queue) opts.queue = filters.queue
    if (filters.tenant) opts.tenant = filters.tenant
    confirm(t(key, opts), flush, { danger: true })
  }

  // Shared columns (queue, tenant, job) + tab-specific columns.
  const columns: Column<FailedJobRow>[] = [
    ...jobColumns(t),
    // TAAKBEHEER-HORIZON-1b: the workflow:<key> tag off the failing job's payload, or a dash when it isn't a workflow run.
    { key: 'workflow', header: t('jobs.col.workflow'), nowrap: true, render: (r: FailedJobRow) => r.workflow ?? '—' },
    // JOB-PROVENANCE-1: wie de job aanvroeg + over welk record hij ging.
    { key: 'requested_by', header: t('jobs.recent.colBy'), nowrap: true, render: (r: FailedJobRow) => r.requested_by ?? '—' },
    { key: 'subject', header: t('jobs.recent.colSubject'), nowrap: true,
      render: (r: FailedJobRow) => r.subject ? <Mono style={{ fontSize: 12 }}>{r.subject.type} {r.subject.reference}</Mono> : '—' },
    { key: 'exception_summary', header: t('jobs.col.exception'),
      render: (r: FailedJobRow) => <span style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{r.exception_summary}</span> },
    { key: 'failed_at', header: t('jobs.col.failedAt'), nowrap: true, render: (r: FailedJobRow) => formatDT(r.failed_at) },
    { key: 'actions', header: t('jobs.col.actions'), align: 'right' as const, nowrap: true,
      render: (r: FailedJobRow) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="secondary" disabled={busyId === r.uuid} onClick={() => retry(r.uuid)}>
            {t('jobs.retry')}
          </Button>
          <Button variant="dangerSoft" disabled={busyId === r.uuid} onClick={() => confirm(t('jobs.forgetConfirm'), () => forget(r.uuid), { danger: true })}>
            {t('jobs.forget')}
          </Button>
        </div>
      ) },
  ]

  return (
    <div>
      {/* Filters + bulk actions (FailedJobsTab-specific). */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          <JobsFilterBar filters={filters} setFilter={setFilter} labels={t} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" disabled={bulkBusy || result.total === 0} onClick={confirmRetryAll}>
            <RefreshCw size={12} /> {t('jobs.retryAll')}
          </Button>
          <Button variant="dangerSoft" disabled={bulkBusy || result.total === 0} onClick={confirmFlush}>
            <Trash2 size={12} /> {t('jobs.flush')}
          </Button>
        </div>
      </div>

      {actionError && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginBottom: 12,
          borderRadius: 8, background: 'var(--color-warning-bg)', border: tintBorder('var(--color-warning)') }}>
          <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{actionError}</span>
          <Button variant="ghost" iconOnly onClick={() => setActionError(null)} aria-label={t('common.close')}>
            <X size={13} />
          </Button>
        </div>
      )}

      {/* BE caps this list at the newest 5.000 (audit 15-07) — say so instead of implying completeness. */}
      {truncated && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px', fontStyle: 'italic' }}>
          {t('jobs.truncatedNotice')}
        </p>
      )}

      <JobsTableFrame phase={phase} columns={columns} rows={result.rows as FailedJobRow[]} emptyText={t('jobs.emptyFailed')} getRowId={(r: FailedJobRow) => r.uuid} />

      {result.lastPage > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('jobs.pagination.prev')}
          </Button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.pagination.page', { page: result.page, last: result.lastPage })}</span>
          <Button variant="secondary" disabled={page >= result.lastPage} onClick={() => setPage(page + 1)}>
            {t('jobs.pagination.next')}
          </Button>
        </div>
      )}
      {dialog}
    </div>
  )
}
