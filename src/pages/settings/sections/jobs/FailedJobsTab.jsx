/**
 * FailedJobsTab — Taakbeheer → Mislukt: the failure log with per-row retry/forget
 * and the two bulk interventions (retry-all, flush). Both bulk actions are
 * destructive/irreversible, so each is gated behind a native confirm() naming
 * the exact count — mirrors the confirm pattern used for API-key/webhook delete
 * elsewhere in Settings (no custom modal component exists for this yet).
 */
import { useTranslation } from 'react-i18next'
import { RefreshCw, Trash2, X } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import { formatDT } from '@/components/reports/runFormat'
import { useFailedJobs } from './useFailedJobs'

export default function FailedJobsTab() {
  const { t } = useTranslation('settings')
  const {
    filters, setFilter, page, setPage, result, phase,
    retry, forget, retryAll, flush, busyId, bulkBusy, actionError, setActionError,
  } = useFailedJobs()

  // Bulk actions are irreversible — confirm with the exact count before firing.
  const confirmRetryAll = () => { if (window.confirm(t('jobs.retryAllConfirm', { count: result.total }))) retryAll() }
  const confirmFlush = () => { if (window.confirm(t('jobs.flushConfirm', { count: result.total }))) flush() }

  const columns = [
    { key: 'queue', header: t('jobs.col.queue'), nowrap: true },
    { key: 'tenant_id', header: t('jobs.col.tenant'), nowrap: true,
      render: (r) => r.tenant_id === 'central' ? t('jobs.centralTenant') : r.tenant_id },
    { key: 'job', header: t('jobs.col.job'), render: (r) => <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.job}</span> },
    { key: 'exception_summary', header: t('jobs.col.exception'),
      render: (r) => <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{r.exception_summary}</span> },
    { key: 'failed_at', header: t('jobs.col.failedAt'), nowrap: true, render: (r) => formatDT(r.failed_at) },
    { key: 'actions', header: t('jobs.col.actions'), align: 'right', nowrap: true,
      render: (r) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" disabled={busyId === r.uuid} onClick={() => retry(r.uuid)}
            style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 7, cursor: busyId === r.uuid ? 'wait' : 'pointer',
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
            {t('jobs.retry')}
          </button>
          <button type="button" disabled={busyId === r.uuid} onClick={() => { if (window.confirm(t('jobs.forgetConfirm'))) forget(r.uuid) }}
            style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 7, cursor: busyId === r.uuid ? 'wait' : 'pointer',
              border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            {t('jobs.forget')}
          </button>
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
          <button type="button" disabled={bulkBusy || result.total === 0} onClick={confirmRetryAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 12, fontWeight: 500,
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)',
              cursor: bulkBusy || result.total === 0 ? 'not-allowed' : 'pointer', opacity: bulkBusy || result.total === 0 ? 0.5 : 1 }}>
            <RefreshCw size={12} /> {t('jobs.retryAll')}
          </button>
          <button type="button" disabled={bulkBusy || result.total === 0} onClick={confirmFlush}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 12, fontWeight: 500,
              border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', borderRadius: 8,
              background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
              cursor: bulkBusy || result.total === 0 ? 'not-allowed' : 'pointer', opacity: bulkBusy || result.total === 0 ? 0.5 : 1 }}>
            <Trash2 size={12} /> {t('jobs.flush')}
          </button>
        </div>
      </div>

      {actionError && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', marginBottom: 12,
          borderRadius: 8, background: 'var(--color-warning-bg)', border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)' }}>
          <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label={t('common.close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={13} /></button>
        </div>
      )}

      {phase === 'error' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.loadError')}</p>}

      {phase !== 'error' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
          <DataTable columns={columns} rows={result.rows} loading={phase === 'loading'} emptyText={t('jobs.emptyFailed')} getRowId={(r) => r.uuid} />
        </div>
      )}

      {result.lastPage > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
            {t('jobs.pagination.prev')}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.pagination.page', { page: result.page, last: result.lastPage })}</span>
          <button type="button" disabled={page >= result.lastPage} onClick={() => setPage((p) => p + 1)}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: page >= result.lastPage ? 'not-allowed' : 'pointer', opacity: page >= result.lastPage ? 0.5 : 1 }}>
            {t('jobs.pagination.next')}
          </button>
        </div>
      )}
    </div>
  )
}
