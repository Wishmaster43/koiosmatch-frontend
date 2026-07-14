/**
 * OutreachDrawer — the drill-down for one bellijst (campaign), on the shared
 * EntityDrawer/EntityHeader shell (§3A blueprint; this was the ONE entity without a
 * drawer — audit 2026-07-03). Thin container: data via useOutreachDetail, header
 * config + a single Targets tab; all row markup lives in drawer/TargetsTab.
 *
 * DRAWER-STD-1 (2026-07-14): the status pill that used to float in the body
 * `children` now sits in the title as a read-only badge (mirrors the candidate
 * phase badge). Owner is a real picker — UpdateOutreachCampaignRequest accepts
 * owner_id (measured in app/Http/Requests/Outreach) — via useOutreachDetail.setOwner.
 * No changelog icon: there is no /outreach-campaigns/{id}/activity route yet
 * (grepped routes/api/tenant/tasks-outreach.php) — OUTREACH-ACTIVITY-1.
 */
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import type { EntityTab } from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import TitleBadge from '@/components/drawer/TitleBadge'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import { initialsOf } from '@/lib/initials'
import { useUsers } from '@/lib/queries'
import { useOutreachDetail } from './hooks/useOutreachDetail'
import TargetsTab from './drawer/TargetsTab'
import type { Id } from '@/types/common'

// Campaign status → semantic colour for the header badge (draft calm, done success).
const STATUS_COLOR: Record<string, string> = {
  draft: '#94A3B8', active: '#19A5CA', done: '#16A34A',
}

interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string }
const userName = (u: UserLike): string => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

export default function OutreachDrawer({ id, createdAt, onClose, expanded = false, onToggleExpand }: {
  id: string | null
  createdAt?: string
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
}) {
  const { t } = useTranslation('outreach')
  const { formatDateTime } = useDateFormat()
  const { detail, loading, error, setTargetStatus, setTargetOutcome, setOwner, setCustomFields } = useOutreachDetail(id)
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  // The Extra tab only shows when the tenant has defined outreach-campaign custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('outreach_campaign')
  if (!id) return null

  const name = detail?.name ?? '…'
  const st   = (detail?.status as string) ?? 'draft'
  const done = (detail?.targets ?? []).filter(tg => tg.status && tg.status !== 'todo').length
  const total = detail?.targets?.length ?? detail?.targets_count ?? 0

  // Owner options — the current owner first (if not already in the list), then
  // every selectable user (mirrors OpportunityDrawer's ownerOptions pattern).
  const ownerOptions = [
    ...(users.some(u => String(u.id) === String(detail?.owner?.id)) || !detail?.owner?.name
      ? [] : [{ value: String(detail?.owner?.id ?? ''), label: detail?.owner?.name ?? '' }]),
    ...users.map(u => ({ value: String(u.id), label: userName(u) })),
  ]
  const onOwnerChange = (v: string) => {
    if (!id) return
    const u = users.find(x => String(x.id) === v)
    setOwner(id, u ? { id: String(u.id), name: userName(u) } : null)
  }

  // Tabs are config (§3A) — the call list is the main tab; Extra is appended when defined.
  const tabs: EntityTab[] = [
    { id: 'targets', label: t('drawer.tabs.targets'), render: () => (
      <TargetsTab targets={detail?.targets ?? []} loading={loading} error={error} onSetStatus={setTargetStatus} onSetOutcome={setTargetOutcome} />
    ) },
    ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra'), render: () => (
      <CustomFieldsTab entityType="outreach_campaign" values={detail?.custom_fields ?? {}}
        onSave={patch => { if (id) setCustomFields(id, patch) }} />
    ) }] : []),
  ]

  return (
    <EntityDrawer
      entity={{ id }}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      // Two-sided footer (§3A(8)): created-at left, empty right (consistent spacing
      // with the candidate/other drawers even when there is no right-side content).
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{t('drawer.createdAt', { date: formatDateTime(createdAt) })}</span>
          <span />
        </div>
      }
      header={
        <EntityHeader
          label={t('drawer.label')}
          avatar={{ initials: initialsOf(name), soft: true }}
          renderTitle={() => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
                {/* Status badge — colour-coded, read-only (was the body StatusPill, §3A(c)). */}
                <TitleBadge label={t(`status.${st}`, { defaultValue: st })} color={STATUS_COLOR[st] ?? '#94A3B8'} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('drawer.progress', { done, total })}</div>
            </>
          )}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
          // Standard picker widths (§3A blueprint: Eigenaar ~190).
          meta={[
            { key: 'owner', label: t('drawer.owner'), value: String(detail?.owner?.id ?? ''),
              options: ownerOptions, placeholder: t('drawer.selectOwner'),
              onChange: onOwnerChange, menuWidth: 200, width: 190 },
          ]}
        />
      }
      tabs={tabs}
    />
  )
}
