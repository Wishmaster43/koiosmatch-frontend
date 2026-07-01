/**
 * ApiKeyList — the "API keys" overview: a header with the count + create button,
 * and a themed DataTable mirroring the SM "API gebruikers" columns. Clicking a
 * row opens the detail. Handles the loading / error / empty / success states.
 */
import { useTranslation } from 'react-i18next'
import { Plus, RefreshCw } from 'lucide-react'
import DataTable from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import { useDateFormat } from '@/lib/datetime'
import { shortGuid } from './constants'

export default function ApiKeyList({ keys, loading, error, onReload, onOpen, onNew }) {
  const { t } = useTranslation('settings')
  const { formatDate } = useDateFormat()

  // Status pill colours for active / disabled keys (shared StatusBadge override).
  const statusMap = {
    active:   { label: t('apiKeys.status.active'),   bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    disabled: { label: t('apiKeys.status.disabled'), bg: 'var(--hover-bg)', color: 'var(--text-muted)' },
  }

  // Column model for the keys table — name, status, org, type, guid, dates.
  const columns = [
    { key: 'friendly_name', header: t('apiKeys.col.name'), sortable: true,
      sortValue: (r) => r.friendly_name ?? r.name ?? '',
      render: (r) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.friendly_name ?? r.name ?? '—'}</span> },
    { key: 'status', header: t('apiKeys.col.status'),
      render: (r) => <StatusBadge status={r.status ?? 'active'} map={statusMap} /> },
    { key: 'organisation', header: t('apiKeys.col.organisation'),
      render: (r) => r.organisation ?? '—' },
    { key: 'type', header: t('apiKeys.col.type'),
      render: (r) => t(`apiKeys.type.${r.type ?? 'additional'}`, { defaultValue: r.type ?? '—' }) },
    { key: 'guid', header: t('apiKeys.col.guid'), nowrap: true,
      render: (r) => <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)' }}>{shortGuid(r.guid)}</code> },
    { key: 'created_at', header: t('apiKeys.col.created'), nowrap: true, sortable: true,
      sortValue: (r) => r.created_at ?? '', render: (r) => formatDate(r.created_at) },
    { key: 'updated_at', header: t('apiKeys.col.updated'), nowrap: true, sortable: true,
      sortValue: (r) => r.updated_at ?? '', render: (r) => formatDate(r.updated_at) },
  ]

  return (
    <div>
      {/* Header: title + count on the left, create button on the right */}
      <div className="flex items-center justify-between" style={{ marginBottom: 18, gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('apiKeys.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {t('apiKeys.count', { count: keys.length })}
          </p>
        </div>
        <button onClick={onNew}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 8, background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> {t('apiKeys.new')}
        </button>
      </div>

      {/* Error state with a retry, else the table (which handles loading/empty) */}
      {error ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('apiKeys.loadError')}</p>
          <button onClick={onReload}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
            <RefreshCw size={13} /> {t('apiKeys.retry')}
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={keys}
          onRowClick={(r) => onOpen(r.id)}
          loading={loading}
          loadingText={t('common.loadingShort')}
          emptyText={t('apiKeys.empty')}
        />
      )}
    </div>
  )
}
