/**
 * OutreachList — the campaigns table (themed DataTable) with the error / loading /
 * empty / success states. The page owns the toolbar (view toggle + create); this
 * component just renders rows. Clicking a row opens the campaign detail (step 2).
 */
import { useTranslation } from 'react-i18next'
import { RefreshCw, Phone, Mail, MessageCircle } from 'lucide-react'
import DataTable, { type Column } from '@/components/ui/DataTable'
import StatusBadge from '@/components/ui/StatusBadge'
import SoftChip from '@/components/ui/SoftChip'
import Avatar from '@/components/ui/Avatar'
import { initialsOf } from '@/lib/initials'
import { useDateFormat } from '@/lib/datetime'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { Campaign } from './hooks/useOutreachCampaigns'

// Icon + colour per outreach channel (soft-chip convention).
const CHANNEL_META: Record<string, { icon: typeof Phone; color: string }> = {
  call:     { icon: Phone,         color: '#2563EB' },
  email:    { icon: Mail,          color: '#D97706' },
  whatsapp: { icon: MessageCircle, color: '#25D366' },
}

// Neutral grey fallback (§3A owner-cell convention) when no colour is available.
const NEUTRAL_AVATAR = '#9CA3AF'

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
  // Tenant display settings (Settings → Bellijsten → Tabelweergave). Coloured chips
  // ON by default, mirrors candidates/applications/customers.
  const settings = useAllSettings()
  const colorChannel = getBoolSetting(settings, 'outreach_table_color_channel', true)
  const colorStatus  = getBoolSetting(settings, 'outreach_table_color_status', true)
  const colorOwner   = getBoolSetting(settings, 'outreach_table_color_owner', true)

  // Status pill colours for draft / active / done.
  const statusMap = {
    draft:  { label: t('status.draft'),  bg: 'var(--hover-bg)',        color: 'var(--text-muted)' },
    active: { label: t('status.active'), bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    done:   { label: t('status.done'),   bg: 'var(--color-primary-bg)', color: 'var(--color-primary)' },
  }

  // Column order mirrors the candidates blueprint (§3A): identity → qualification →
  // status → counts → dates → owner LAST (Danny 2026-07-14 table standardization).
  const columns: Column<Campaign>[] = [
    { key: 'name', header: t('col.name'), sortable: true, sortValue: (r: Campaign) => r.name ?? '', width: 260, nowrap: true,
      render: (r: Campaign) => <span style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 260 }} title={r.name}>{r.name ?? '—'}</span> },
    { key: 'channel', header: t('col.channel'),
      render: (r: Campaign) => {
        const m = CHANNEL_META[r.channel ?? 'call'] ?? CHANNEL_META.call
        const Icon = m.icon
        const label = t(`channel.${r.channel}`, { defaultValue: r.channel ?? '—' })
        if (!colorChannel) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text)', fontSize: 12 }}><Icon size={12} /> {label}</span>
        return <SoftChip color={m.color} label={<><Icon size={12} /> {label}</>} />
      } },
    { key: 'status', header: t('col.status'),
      render: (r: Campaign) => {
        const s = statusMap[(r.status ?? 'draft') as keyof typeof statusMap] ?? statusMap.draft
        return colorStatus ? <StatusBadge status={r.status ?? 'draft'} map={statusMap} /> : <span style={{ color: 'var(--text)', fontSize: 12 }}>{s.label}</span>
      } },
    { key: 'targets', header: t('col.targets'), align: 'center',
      render: (r: Campaign) => r.targets_count ?? r.target_count ?? '—' },
    { key: 'created_at', header: t('col.created'), nowrap: true, sortable: true,
      sortValue: (r: Campaign) => r.created_at ?? '', render: (r: Campaign) => formatDate(r.created_at) },
    // Owner — avatar + name. LAST column (§3A convention). The campaign resource's
    // owner is `{id, name}` only, no per-user colour field yet (verified against
    // OutreachCampaignResource.php — BE gap), so `colorOwner` toggles between
    // Avatar's own deterministic name-hash palette and a flat neutral grey.
    { key: 'owner', header: t('col.owner'), sortable: true, sortValue: (r: Campaign) => r.owner?.name ?? '',
      render: (r: Campaign) => r.owner?.name ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Avatar initials={initialsOf(r.owner.name)} size={18} color={colorOwner ? undefined : NEUTRAL_AVATAR} soft />
          <span style={{ fontSize: 12, color: 'var(--text)' }}>{r.owner.name}</span>
        </span>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span> },
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
      defaultSort={{ key: 'created_at', dir: 'desc' }}
    />
  )
}
