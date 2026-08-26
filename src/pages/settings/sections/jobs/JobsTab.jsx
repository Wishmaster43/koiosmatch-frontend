import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import StatusPill from '@/components/ui/StatusPill'
import { formatDT, formatDuration } from '@/components/reports/runFormat'
import { useJobsList } from './useJobsList'
import SearchSelect from '@/components/ui/SearchSelect'
import { Mono } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import { tintBorder } from '@/lib/tint'

const STATE_COLOR = { pending: 'var(--text-muted)', reserved: 'var(--color-warning)' }

/**
 * JobsTab — Taakbeheer → Taken: the live pending/reserved backlog, filterable by
 * queue/tenant/status, with runtime for jobs currently being executed and a
 * cancel action for jobs that HAVEN'T started yet. A cancel can still race a
 * worker picking the job up between render and click — the resulting 409 is
 * shown inline with the backend's own explanation rather than swallowed.
 */
export default function JobsTab() {
  const { t } = useTranslation('settings')
  const { filters, setFilter, page, setPage, result, phase, cancel, cancelError, setCancelError } = useJobsList()

  const columns = [
    { key: 'queue', header: t('jobs.col.queue'), nowrap: true },
    { key: 'tenant_id', header: t('jobs.col.tenant'), nowrap: true,
      render: (r) => r.tenant_id === 'central' ? t('jobs.centralTenant') : r.tenant_id },
    { key: 'job', header: t('jobs.col.job'), render: (r) => <Mono style={{ fontSize: 12 }}>{r.job}</Mono> },
    { key: 'attempts', header: t('jobs.col.attempts'), align: 'right' },
    { key: 'created_at', header: t('jobs.col.createdAt'), nowrap: true, render: (r) => formatDT(r.created_at) },
    { key: 'state', header: t('jobs.col.status'), nowrap: true,
      render: (r) => {
        const state = r.reserved_at ? 'reserved' : 'pending'
        return <StatusPill label={t(`jobs.state.${state}`)} color={STATE_COLOR[state]} />
      } },
    { key: 'runtime', header: t('jobs.col.runtime'), align: 'right', nowrap: true,
      render: (r) => r.reserved_at ? formatDuration((r.runtime_seconds ?? 0) * 1000) : '—' },
    { key: 'actions', header: t('jobs.col.actions'), align: 'right', nowrap: true,
      render: (r) => r.reserved_at ? null : (
        <Button variant="dangerSoft" size="sm" onClick={() => cancel(r.id)}>{t('jobs.cancel')}</Button>
      ) },
  ]

  return (
    <div>
      {/* Filters — queue/tenant are free text (the backend has no enum for either); status is a fixed 2-value set. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={filters.queue} onChange={(e) => setFilter('queue', e.target.value)} placeholder={t('jobs.filters.queue')}
          style={{ height: 32, padding: '0 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', width: 160 }} />
        <input value={filters.tenant} onChange={(e) => setFilter('tenant', e.target.value)} placeholder={t('jobs.filters.tenant')}
          style={{ height: 32, padding: '0 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', width: 160 }} />
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

      {phase === 'error' && <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 8 }}>{t('jobs.loadError')}</p>}

      {phase !== 'error' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
          <DataTable columns={columns} rows={result.rows} loading={phase === 'loading'} emptyText={t('jobs.empty')} getRowId={(r) => r.id} />
        </div>
      )}

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
