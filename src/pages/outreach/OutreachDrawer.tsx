/**
 * OutreachDrawer — the drill-down for one bellijst (campaign), on the shared
 * EntityDrawer/EntityHeader shell (§3A blueprint; this was the ONE entity without a
 * drawer — audit 2026-07-03). Thin container: data via useOutreachDetail, header
 * config + a single Targets tab; all row markup lives in drawer/TargetsTab.
 */
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import type { EntityTab } from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import StatusPill from '@/components/ui/StatusPill'
import { initialsOf } from '@/lib/initials'
import { useOutreachDetail } from './hooks/useOutreachDetail'
import TargetsTab from './drawer/TargetsTab'

// Campaign status → semantic colour for the header pill (draft calm, done success).
const STATUS_COLOR: Record<string, string> = {
  draft: '#94A3B8', active: '#19A5CA', done: '#16A34A',
}

export default function OutreachDrawer({ id, createdAt, onClose, expanded = false, onToggleExpand }: {
  id: string | null
  createdAt?: string
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
}) {
  const { t } = useTranslation('outreach')
  const { formatDateTime } = useDateFormat()
  const { detail, loading, error, setTargetStatus, setTargetOutcome } = useOutreachDetail(id)
  if (!id) return null

  const name = detail?.name ?? '…'
  const st   = (detail?.status as string) ?? 'draft'
  const done = (detail?.targets ?? []).filter(tg => tg.status && tg.status !== 'todo').length
  const total = detail?.targets?.length ?? detail?.targets_count ?? 0

  // Tabs are config (§3A) — the call list is the single tab.
  const tabs: EntityTab[] = [
    { id: 'targets', label: t('drawer.tabs.targets'), render: () => (
      <TargetsTab targets={detail?.targets ?? []} loading={loading} error={error} onSetStatus={setTargetStatus} onSetOutcome={setTargetOutcome} />
    ) },
  ]

  return (
    <EntityDrawer
      entity={{ id }}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      footer={<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('drawer.createdAt', { date: formatDateTime(createdAt) })}</span>}
      header={
        <EntityHeader
          label={t('drawer.label')}
          avatar={{ initials: initialsOf(name), soft: true }}
          title={name}
          subtitle={t('drawer.progress', { done, total })}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <StatusPill label={t(`status.${st}`, { defaultValue: st })} color={STATUS_COLOR[st] ?? '#94A3B8'} />
            {detail?.owner?.name && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{detail.owner.name}</span>}
          </div>
        </EntityHeader>
      }
      tabs={tabs}
    />
  )
}
