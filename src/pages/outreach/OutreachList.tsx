/**
 * OutreachList — the campaigns table (themed DataTable) with the error / loading /
 * empty / success states. The page owns the toolbar (view toggle + create); this
 * component just renders rows. Clicking a row opens the campaign detail (step 2).
 */
import { useTranslation } from 'react-i18next'
import { RefreshCw, Phone, Mail, MessageCircle } from 'lucide-react'
import DataTable, { type Column } from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import { useDateFormat } from '@/lib/datetime'
import type { Campaign } from './hooks/useOutreachCampaigns'

// Icon + colour per outreach channel (soft-chip convention).
const CHANNEL_META: Record<string, { icon: typeof Phone; color: string }> = {
  call:     { icon: Phone,         color: '#2563EB' },
  email:    { icon: Mail,          color: '#D97706' },
  whatsapp: { icon: MessageCircle, color: '#25D366' },
}

interface Props {
  campaigns: Campaign[]
  loading: boolean
  error: boolean
  onReload: () => void
  onOpen?: (id: string) => void
  emptyText?: string
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleRow?: (id: string) => void
  onToggleAll?: (ids: string[], allSelected: boolean) => void
}

export default function OutreachList({ campaigns, loading, error, onReload, onOpen, emptyText,
  selectable, selectedIds, onToggleRow, onToggleAll }: Props) {
  const { t } = useTranslation('outreach')
  const { formatDate } = useDateFormat()

  // Status pill colours for draft / active / done.
  const statusMap = {
    draft:  { label: t('status.draft'),  bg: 'var(--hover-bg)',        color: 'var(--text-muted)' },
    active: { label: t('status.active'), bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    done:   { label: t('status.done'),   bg: 'var(--color-primary-bg)', color: 'var(--color-primary)' },
  }

  // Column model: name, channel chip, status, target count, owner, created.
  const columns: Column<Campaign>[] = [
    { key: 'name', header: t('col.name'), sortable: true, sortValue: (r: Campaign) => r.name ?? '',
      render: (r: Campaign) => <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.name ?? '—'}</span> },
    { key: 'channel', header: t('col.channel'),
      render: (r: Campaign) => {
        const m = CHANNEL_META[r.channel ?? 'call'] ?? CHANNEL_META.call
        const Icon = m.icon
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500,
            padding: '2px 8px', borderRadius: 99, background: m.color + '1A', color: m.color, border: `1px solid ${m.color}55` }}>
            <Icon size={12} /> {t(`channel.${r.channel}`, { defaultValue: r.channel ?? '—' })}
          </span>
        )
      } },
    { key: 'status', header: t('col.status'),
      render: (r: Campaign) => <StatusBadge status={r.status ?? 'draft'} map={statusMap} /> },
    { key: 'targets', header: t('col.targets'), align: 'center',
      render: (r: Campaign) => r.targets_count ?? r.target_count ?? '—' },
    { key: 'owner', header: t('col.owner'),
      render: (r: Campaign) => r.owner?.name ?? '—' },
    { key: 'created_at', header: t('col.created'), nowrap: true, sortable: true,
      sortValue: (r: Campaign) => r.created_at ?? '', render: (r: Campaign) => formatDate(r.created_at) },
  ]

  // Error state with a retry, else the table (which handles loading/empty).
  if (error) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{t('loadError')}</p>
        <button onClick={onReload}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text)' }}>
          <RefreshCw size={13} /> {t('retry')}
        </button>
      </div>
    )
  }

  return (
    <DataTable
      columns={columns}
      rows={campaigns}
      onRowClick={onOpen ? (r: Campaign) => onOpen(r.id) : undefined}
      loading={loading}
      loadingText={t('common:loadingShort', { defaultValue: '…' })}
      emptyText={emptyText ?? t('empty')}
      selectable={selectable}
      selectedIds={selectedIds as Set<string | number> | undefined}
      onToggleRow={onToggleRow as ((id: string | number) => void) | undefined}
      onToggleAll={onToggleAll as ((ids: (string | number)[], allSelected: boolean) => void) | undefined}
    />
  )
}
