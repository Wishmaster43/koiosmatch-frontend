/**
 * WebhookList — the outgoing-webhook overview: header with the count + create
 * button and a themed DataTable. Clicking a row opens the detail. Handles the
 * loading / error / empty / success states.
 */
import { useTranslation } from 'react-i18next'
import { Plus, RefreshCw } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import { useDateFormat } from '@/lib/datetime'

export default function WebhookList({ subs, loading, error, onReload, onOpen, onNew }) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()

  // Status pill colours for active / disabled subscriptions.
  const statusMap = {
    active:   { label: t('webhooks.outgoing.status.active'),   bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    disabled: { label: t('webhooks.outgoing.status.disabled'), bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
  }

  // Column model: name, url, status, event count, last triggered.
  const columns = [
    { key: 'name', header: t('webhooks.outgoing.col.name'), sortable: true,
      render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.name ?? '—'}</span> },
    { key: 'url', header: t('webhooks.outgoing.col.url'),
      render: (r) => <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)' }}>{r.url ?? '—'}</code> },
    { key: 'status', header: t('webhooks.outgoing.col.status'),
      render: (r) => <StatusBadge status={r.status ?? 'active'} map={statusMap} /> },
    { key: 'events', header: t('webhooks.outgoing.col.events'), align: 'center',
      render: (r) => t('webhooks.outgoing.eventsCount', { count: (r.event_types ?? []).length }) },
    { key: 'last_triggered_at', header: t('webhooks.outgoing.col.lastTriggered'), nowrap: true, sortable: true,
      sortValue: (r) => r.last_triggered_at ?? '', render: (r) => formatDate(r.last_triggered_at) },
  ]

  return (
    <div>
      {/* Header: title + count, create button */}
      <div className="flex items-center justify-between" style={{ marginBottom: 18, gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('webhooks.outgoing.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('webhooks.outgoing.subtitle')}</p>
        </div>
        <button onClick={onNew}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> {t('webhooks.outgoing.new')}
        </button>
      </div>

      {error ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('webhooks.outgoing.loadError')}</p>
          <button onClick={onReload}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
            <RefreshCw size={13} /> {t('webhooks.outgoing.retry')}
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={subs}
          onRowClick={(r) => onOpen(r.id)}
          loading={loading}
          loadingText={t('common.loadingShort')}
          emptyText={t('webhooks.outgoing.empty')}
        />
      )}
    </div>
  )
}
