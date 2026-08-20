/**
 * FailedJobsTab — Taakbeheer → Mislukt: the failure log with per-row retry/forget
 * and the two bulk interventions (retry-all, flush). Both bulk actions are
 * destructive/irreversible, so each is gated behind the shared ConfirmDialog naming
 * the exact count — mirrors the confirm pattern used for API-key/webhook delete
 * elsewhere in Settings.
 */
import { useTranslation } from 'react-i18next'
import { RefreshCw, Trash2, X } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import { formatDT } from '@/components/reports/runFormat'
import { useConfirm } from '@/hooks/useConfirm'
import { useFailedJobs } from './useFailedJobs'
import Button from '@/components/ui/Button'
import { Mono } from '@/components/ui/typography'
import { tintBorder } from '@/lib/tint'

export default function FailedJobsTab() {
  const { t } = useTranslation('settings')
  const {
    filters, setFilter, page, setPage, result, phase,
    retry, forget, retryAll, flush, busyId, bulkBusy, actionError, setActionError,
    truncated,
  } = useFailedJobs()
  const { confirm, dialog } = useConfirm()

  // Bulk actions are irreversible — confirm with the exact count before firing.
  const confirmRetryAll = () => confirm(t('jobs.retryAllConfirm', { count: result.total }), retryAll)
  const confirmFlush = () => confirm(t('jobs.flushConfirm', { count: result.total }), flush, { danger: true })

  const columns = [
    { key: 'queue', header: t('jobs.col.queue'), nowrap: true },
    { key: 'tenant_id', header: t('jobs.col.tenant'), nowrap: true,
      render: (r) => r.tenant_id === 'central' ? t('jobs.centralTenant') : r.tenant_id },
    { key: 'job', header: t('jobs.col.job'), render: (r) => <Mono style={{ fontSize: 12 }}>{r.job}</Mono> },
    // TAAKBEHEER-HORIZON-1b: the workflow:<key> tag off the failing job's payload, or a dash when it isn't a workflow run.
    { key: 'workflow', header: t('jobs.col.workflow'), nowrap: true, render: (r) => r.workflow ?? '—' },
    // JOB-PROVENANCE-1: wie de job aanvroeg + over welk record hij ging.
    { key: 'requested_by', header: t('jobs.recent.colBy'), nowrap: true, render: (r) => r.requested_by ?? '—' },
    { key: 'subject', header: t('jobs.recent.colSubject'), nowrap: true,
      render: (r) => r.subject ? <Mono style={{ fontSize: 12 }}>{r.subject.type} {r.subject.reference}</Mono> : '—' },
    { key: 'exception_summary', header: t('jobs.col.exception'),
      render: (r) => <span style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{r.exception_summary}</span> },
    { key: 'failed_at', header: t('jobs.col.failedAt'), nowrap: true, render: (r) => formatDT(r.failed_at) },
    { key: 'actions', header: t('jobs.col.actions'), align: 'right', nowrap: true,
      render: (r) => (
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
      {/* Filters + bulk actions. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={filters.queue} onChange={(e) => setFilter('queue', e.target.value)} placeholder={t('jobs.filters.queue')}
          style={{ height: 32, padding: '0 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', width: 160 }} />
        <input value={filters.tenant} onChange={(e) => setFilter('tenant', e.target.value)} placeholder={t('jobs.filters.tenant')}
          style={{ height: 32, padding: '0 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', width: 160 }} />
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
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

      {phase === 'error' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.loadError')}</p>}

      {phase !== 'error' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
          <DataTable columns={columns} rows={result.rows} loading={phase === 'loading'} emptyText={t('jobs.emptyFailed')} getRowId={(r) => r.uuid} />
        </div>
      )}

      {result.lastPage > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('jobs.pagination.prev')}
          </Button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.pagination.page', { page: result.page, last: result.lastPage })}</span>
          <Button variant="secondary" disabled={page >= result.lastPage} onClick={() => setPage((p) => p + 1)}>
            {t('jobs.pagination.next')}
          </Button>
        </div>
      )}
      {dialog}
    </div>
  )
}
