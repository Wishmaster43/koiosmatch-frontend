/**
 * OutreachDrawer — the drill-down for one bellijst (campaign), on the shared
 * EntityDrawer/EntityHeader shell (§3A blueprint; this was the ONE entity without a
 * drawer — audit 2026-07-03). Thin container: data via useOutreachDetail, header
 * config + Targets/Stats tabs; all row markup lives in drawer/TargetsTab and
 * drawer/CampaignStatsTab.
 *
 * G29/G30/G31 (2026-08-08): round-robin recruiter assignment (assignTargets),
 * per-target notes (setTargetNote) and the campaign Stats tab all landed here.
 * The Stats-tab -> Targets-tab click-to-filter axis (targetFilter.ts) lives in
 * THIS container's own state — the one piece of state genuinely shared between
 * two sibling tabs, never duplicated into either tab itself.
 *
 * DRAWER-STD-1 (2026-07-14): the status pill that used to float in the body
 * `children` now sits in the title as a read-only badge (mirrors the candidate
 * phase badge). Owner is a real picker — UpdateOutreachCampaignRequest accepts
 * owner_id (measured in app/Http/Requests/Outreach) — via useOutreachDetail.setOwner.
 * Record history is the shared ChangelogPopover icon in the title row (§3A(d)),
 * fed by GET /outreach-campaigns/{id}/activity — MEASURED as live in
 * routes/api/tenant/tasks-outreach.php (OutreachCampaignController::activityLog,
 * the same LogsEntityActivity feed the customer/candidate/vacancy tabs read), so
 * the old "no activity route yet" gate (OUTREACH-ACTIVITY-1) is gone.
 *
 * W2 delivered (measured): OutreachCampaignController::show is now withTrashed and
 * OutreachCampaignResource carries `archived`/`deleted_at`, so an archived campaign
 * fetches its real detail (targets included) instead of the row's bare fallbacks.
 * The owner picker/PATCH stays gated on archived regardless — update() is still a
 * plain findOrFail (would 404) AND it is a deliberate product choice either way
 * (restore first).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { useCustomFields } from '@/lib/useCustomFields'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import type { EntityTab } from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import TitleBadge from '@/components/drawer/TitleBadge'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import { initialsOf } from '@/lib/initials'
import { useUsers } from '@/lib/queries'
import { useOutreachDetail } from './hooks/useOutreachDetail'
import type { Campaign } from './hooks/useOutreachCampaigns'
import CampaignKoiosBlock from './drawer/CampaignKoiosBlock'
import TargetsTab from './drawer/TargetsTab'
import ChangelogTab from './drawer/ChangelogTab'
import CampaignStatsTab from './drawer/CampaignStatsTab'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import PendingEraseBanner from '@/components/drawer/PendingEraseBanner'
import { buildTrashNote } from '@/hooks/useTrashFlow'
import { Trash2 } from 'lucide-react'
import type { Id } from '@/types/common'
import type { TargetFilter } from './drawer/targetFilter'

// Campaign status → semantic colour for the header badge (draft calm, done success).
const STATUS_COLOR: Record<string, string> = {
  // eslint-disable-next-line no-restricted-syntax -- DATA: fixed status colour map, no token matches this specific calm grey
  draft: '#94A3B8', active: 'var(--color-primary)', done: 'var(--color-success)',
}

interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string }
const userName = (u: UserLike): string => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// Thin container: wires useOutreachDetail's data into the shared drawer shell and owns the Stats-to-Targets click-to-filter state shared by the two tabs.
export default function OutreachDrawer({ id, createdAt, archived = false, archivedAt = null, fallbackName, fallbackStatus, onRestore, inTrash = false, pendingEraseAt = null, graceDays = null, onMarkDeletion, onUnmark, onClose, expanded = false, onToggleExpand, onMutated }: {
  id: string | null
  createdAt?: string
  // Enkelstuks-sweep: soft-deleted row (flag from the page). W2 delivered (measured:
  // show() is now withTrashed), so the drawer fetches the real detail even when
  // archived — the fallbacks below only cover the brief loading gap.
  archived?: boolean
  // W2 delivered (measured: OutreachCampaignResource carries deleted_at) — the
  // banner reads "Archived on {date}"; null falls back to the flag-only line.
  archivedAt?: string | null
  fallbackName?: string
  fallbackStatus?: string
  // Per-id restore — the page passes this only with outreach.update.
  onRestore?: (id: string) => void
  // TRASH-OVERAL-2: trash state (lifecycle pending_erase) + its erase-note inputs.
  inTrash?: boolean
  pendingEraseAt?: string | null
  graceDays?: number | null
  // Mark for erasure (outreach.delete — HIDDEN without) / unmark (outreach.update).
  onMarkDeletion?: (id: string) => void
  onUnmark?: (id: string) => void
  onClose: () => void
  // DRILL-REFRESH-AUDIT-1: reports every successful drawer mutation upstream —
  // with an owner delta when the table shows it, else as a stale-list signal.
  onMutated?: (delta?: { owner?: { id: string; name: string } | null }) => void
  expanded?: boolean
  onToggleExpand?: () => void
}) {
  const { t } = useTranslation('outreach')
  const { formatDate, formatDateTime } = useDateFormat()
  // Always fetch: an archived campaign's detail now loads too (withTrashed show()).
  const { detail, loading, error, setTargetStatus, setTargetOutcome, setTargetNote, applyTargetNote, assignTargets, setOwner, setCustomFields } = useOutreachDetail(id, onMutated)
  const { data: users = [] } = useUsers() as { data?: UserLike[] }
  // The Extra tab only shows when the tenant has defined outreach-campaign custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('outreach_campaign')
  // G31 — the Stats tab's active donut pick, read by the Targets tab to narrow
  // its list. Reset to null whenever the drawer opens on a different campaign.
  const [targetFilter, setTargetFilterState] = useState<TargetFilter>(null)
  const [filterCampaignId, setFilterCampaignId] = useState(id)
  if (id !== filterCampaignId) { setFilterCampaignId(id); setTargetFilterState(null) }
  if (!id) return null

  const name = detail?.name ?? fallbackName ?? '…'
  const st   = (detail?.status as string) ?? fallbackStatus ?? 'draft'
  // eslint-disable-next-line no-restricted-syntax -- DATA: STATUS_COLOR's own draft-calm fallback shade
  const stBadgeColor = STATUS_COLOR[st] ?? '#94A3B8'
  const done = (detail?.targets ?? []).filter(tg => tg.status && tg.status !== 'todo').length
  const total = detail?.targets?.length ?? detail?.targets_count ?? 0

  // Owner options — the current owner first (if not already in the list), then
  // every selectable user (mirrors OpportunityDrawer's ownerOptions pattern).
  const ownerOptions = [
    ...(users.some(u => String(u.id) === String(detail?.owner?.id)) || !detail?.owner?.name
      ? [] : [{ value: String(detail?.owner?.id ?? ''), label: detail?.owner?.name ?? '' }]),
    ...users.map(u => ({ value: String(u.id), label: userName(u) })),
  ]
  // Persists the picked owner (or clears it) for this campaign.
  const onOwnerChange = (v: string) => {
    if (!id) return
    const u = users.find(x => String(x.id) === v)
    setOwner(id, u ? { id: String(u.id), name: userName(u) } : null)
  }

  // G29 — recruiter options for the assign picker; every selectable tenant user
  // (mirrors ownerOptions minus the "current value first" special-case, since
  // the assign picker is a fresh multi-select, not a single current-value field).
  const recruiterOptions = users.map(u => ({ value: String(u.id), label: userName(u) }))

  // KOIOS-ADVIES-OVERAL-1: feed the SAME resolver the table rows go through
  // (useCampaignAdvice reads the list-row shape; CampaignDetail extends it).
  // List/page fallbacks only fill fields the detail payload may lack, so the
  // drawer's advice can never diverge from the row's. Null while loading: the
  // advice block simply doesn't render yet (no empty shell).
  const campaignRow: Campaign | null = detail ? {
    ...detail,
    targets_count: detail.targets_count ?? detail.targets?.length,
    created_at: detail.created_at ?? createdAt,
    archived: detail.archived ?? archived,
  } : null

  // G31 — one shared filter axis, set by a Stats-tab donut click and read by the
  // Targets tab; clicking the SAME value again clears it (mirrors the page-level
  // insights row's donut toggle convention).
  const onPickFilter = (axis: 'status' | 'outcome' | 'assignee', value: string) =>
    setTargetFilterState(f => (f?.axis === axis && f?.value === value) ? null : { axis, value })
  const onClearFilter = () => setTargetFilterState(null)

  // Tabs are config (§3A) — the call list is the main tab; Extra (when defined) sits
  // before Stats, which surfaces the by_status/by_outcome/by_assignee breakdown (G31)
  // and always stays LAST (canon: statistics closes every drilldown).
  const tabs: EntityTab[] = [
    { id: 'targets', label: t('drawer.tabs.targets'), render: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* KOIOS-ADVIES-OVERAL-1: the SAME advice the table's Koios column shows.
            TOP of the main tab (written deviation from the other drawers' bottom
            placement, §4 checklist): the call list below can be hundreds of rows,
            and the block only mounts when there IS advice — absent it adds nothing. */}
        {campaignRow && <CampaignKoiosBlock campaign={campaignRow} />}
        <TargetsTab targets={detail?.targets ?? []} loading={loading} error={error}
          onSetStatus={setTargetStatus} onSetOutcome={setTargetOutcome} onSetNote={setTargetNote}
          campaignId={id} onApplyTargetNote={applyTargetNote}
          recruiters={recruiterOptions} onAssignTargets={assignTargets}
          filter={targetFilter} onClearFilter={onClearFilter} />
      </div>
    ) },
    ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra'), render: () => (
      <CustomFieldsTab entityType="outreach_campaign" values={detail?.custom_fields ?? {}}
        onSave={patch => { if (id) setCustomFields(id, patch) }} />
    ) }] : []),
    // TIJDLIJN-OVERAL (27-08): second-to-last, reuses the same ChangelogTab content
    // the title-row popover renders — the popover itself stays untouched (§3A(d)).
    { id: 'timeline', label: t('drawer.tabs.timeline'), render: () => <ChangelogTab campaignId={id} /> },
    // Stats is always the LAST tab (§3A CANON-CHECKLIST — statistics closes every drilldown).
    { id: 'stats', label: t('drawer.tabs.stats', { defaultValue: 'Stats' }), render: () => (
      <CampaignStatsTab campaignId={id} filter={targetFilter} onPick={onPickFilter} onClear={onClearFilter} />
    ) },
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
          // TITEL-CHIP-1 (Danny 19-08): the status badge IS the title.
          label={<TitleBadge label={t(`status.${st}`, { defaultValue: st })} color={stBadgeColor} />}
          avatar={{ initials: initialsOf(name), soft: true }}
          // Changelog icon (§3A(d)) — the ONE shared house popover shell, same as the
          // other seven entities. Its content mounts (and only then fetches) on open.
          // Stays available while archived: activityLog resolves withTrashed, so an
          // archived bellijst keeps its history readable (ARCH-READ-1).
          titleActions={<>
            <ChangelogPopover><ChangelogTab campaignId={id} /></ChangelogPopover>
            {/* TRASH-OVERAL-2: archived → trash (outreach.delete-gated at the page;
                the shared preview modal confirms). Hidden once already in the trash. */}
            {onMarkDeletion && archived && !inTrash && (
              <button onClick={() => onMarkDeletion(id)}
                title={t('common:trash.markAction')} aria-label={t('common:trash.markAction')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-danger-text)' }}>
                <Trash2 size={14} />
              </button>
            )}
          </>}
          renderTitle={() => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{name}</span>
                {/* NUMMER-3: the copy chip, right after the title and before the status badge (§3A). */}
                <ReferenceNumberChip value={detail?.reference_number ?? ''} />
              </div>
              {/* W2 delivered: the detail (incl. targets) now loads for an archived
                  campaign too, so the real progress shows regardless of archive state
                  — the ArchivedBanner below already carries the archived signal. */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t('drawer.progress', { done, total })}
              </div>
            </>
          )}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
          // Standard picker widths (§3A blueprint: Eigenaar ~190). ARCHIVED: no owner
          // picker on an inactive record — update() is still a plain findOrFail (404s
          // on a soft-deleted campaign) AND the gating is a deliberate product choice
          // either way; restore first.
          meta={archived ? [] : [
            { key: 'owner', label: t('drawer.owner'), value: String(detail?.owner?.id ?? ''),
              options: ownerOptions, placeholder: t('drawer.selectOwner'),
              onChange: onOwnerChange, menuWidth: 200, width: 190 },
          ]}
        >
          {/* Enkelstuks-sweep: archived state + per-id restore via the ONE shared
              ArchivedBanner (§3A — extend, never duplicate). W2 delivered (measured:
              OutreachCampaignResource now carries deleted_at) → dated banner; falls
              back to the flag-only line when archivedAt is absent. */}
          {archived && !inTrash && (
            <ArchivedBanner id={id} onRestore={onRestore ? () => onRestore(id) : undefined}
              message={archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(archivedAt) }) : t('drawer.archivedBanner.flag')}
              restoreLabel={t('drawer.archivedBanner.restore')} />
          )}
          {/* TRASH-OVERAL-2: trash state — since-when + projected erase moment
              (DD-MM-YYYY via the house formatter) + the unmark ("back to archive")
              action, outreach.update-gated at the page. */}
          {inTrash && (
            <PendingEraseBanner id={id}
              message={buildTrashNote(t, formatDate, pendingEraseAt, graceDays)}
              onUnmark={onUnmark ? () => onUnmark(id) : undefined}
              unmarkLabel={t('common:trash.unmarkAction')} />
          )}
        </EntityHeader>
      }
      tabs={tabs}
    />
  )
}
