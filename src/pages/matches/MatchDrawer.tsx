/**
 * MatchDrawer — the drill-down for one match, built on the shared EntityDrawer +
 * EntityHeader shell (§3A blueprint). The match facts (candidate/vacancy/client/
 * score/stage) stay read-only — a match is the continuation of a Hired
 * application (§3B) and those are derived — but the match's contract/financial
 * layer IS editable in-place. Three real tabs (Danny, 2026-07-14: "ook tabjes maken
 * voor de drill down" — one tab used to wear the summary + the whole contract form
 * at once): Overzicht (facts/score/status), Contract & financieel
 * (MatchContractSection, moved as-is), Relaties (candidate/vacancy/klant, each a
 * cross-entity hyperlink — RelationsTab). A Notities tab is NOT added: the
 * backend has no /matches/{id}/notes route yet (grepped
 * routes/api/tenant/applications-matches.php — only CRUD + approve/reject/contract
 * exist), so ChangelogTab stays the icon-popover it already was rather than a fake
 * tab. Header meta row (DRAWER-STD-1, 2026-07-14): a standard Status picker (the
 * same /match-statuses lookup the board/table use, ~160) + a real Eigenaar picker
 * (MATCH-OWNER-1, 2026-07-31) — PATCH /matches/{id} accepts `owner_id`
 * (UpdateMatchRequest → PlacementRules trait, tenant-validated), so reassigning
 * persists like every other entity. Thin container: header config + tab list + the
 * useMatchApproval wiring; all body markup lives in the tab/header components.
 */
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import type { EntityTab } from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import { useDateFormat } from '@/lib/datetime'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useCustomFields } from '@/lib/useCustomFields'
import { useUsers } from '@/lib/queries'
import { initialsOf } from '@/lib/initials'
import ScorePill from './ScorePill'
import OverviewTab from './drawer/OverviewTab'
import RelationsTab from './drawer/RelationsTab'
import MatchContractSection from './drawer/MatchContractSection'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ChangelogTab from './drawer/ChangelogTab'
import MatchApprovalBadge from './drawer/MatchApprovalBadge'
import MatchApprovalActions from './drawer/MatchApprovalActions'
import { useMatchApproval } from './hooks/useMatchApproval'
import type { OwnerCandidate } from './hooks/useMatchMutations'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'

interface MatchDrawerProps {
  match: MatchRow | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  // R-1b: change the lifecycle status (lookup-driven); omitting keeps the tab read-only.
  onSetStatus?: (status: string) => void
  // MATCH-OWNER-1: reassign the match's owner (PATCH owner_id). Omitting it — or an
  // archived match — renders the owner as an honest read-only value, never a dead picker.
  onSetOwner?: (user: OwnerCandidate) => void
  // Approval workflow (§7 — UI-only gate; the backend re-checks matches.update).
  canApprove?: boolean
  onApprovalChange?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
  // General row patch — used by the contract/financial edit (the Contract tab,
  // MatchContractSection) to refresh the row/header when a save echoes back a
  // recomputed approval_status.
  onUpdate?: (id: MatchRow['id'], patch: Partial<MatchRow>) => void
  // Save the Extra tab's tenant custom fields (§3B) — a partial patch, merged by the caller.
  onUpdateCustomFields?: (id: MatchRow['id'], patch: Record<string, unknown>) => void
  // ARCHIVE-1: per-id soft-delete/restore (§7 — UI-only gate; the backend re-checks
  // matches.update). Absent = no permission, so the trash icon/restore button don't render.
  onArchive?: (id: MatchRow['id']) => void
  onRestore?: (id: MatchRow['id']) => void
  // EXTRACT-1: the caller's own matches.update permission check for the
  // Koppelingen tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
}

export default function MatchDrawer({
  match, onClose, expanded = false, onToggleExpand, onSetStatus, onSetOwner, canApprove = false, onApprovalChange, onUpdate, onUpdateCustomFields,
  onArchive, onRestore, canLinkBackoffice = false,
}: MatchDrawerProps) {
  const { t } = useTranslation('matches')
  const { formatDate, formatDateTime } = useDateFormat()
  // Approval data/actions live in one hook here (thin container, §3) — the header
  // pieces below stay presentational.
  const { reason, busy, rejectOpen, setRejectOpen, approve, reject } = useMatchApproval(match, onApprovalChange)
  // R-1b lifecycle status — the same tenant lookup the board/table use.
  const { statuses: matchStatuses } = useMatchStatuses()
  // The Extra tab only shows when the tenant has defined match custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('match')
  // MATCH-OWNER-1: the tenant's users, the owner picker's options (cached app-wide).
  const { data: users = [] } = useUsers() as { data?: OwnerCandidate[] }
  if (!match) return null

  // Owner picker options, mirroring CandidateDrawer: a synthetic entry for the
  // CURRENT owner only when that user is missing from /users (a deactivated or
  // not-yet-loaded owner must still show its name, and always prepending it would
  // duplicate the owner). It renders DISABLED: it is a label, not a target, and a
  // clickable row that silently does nothing reads as broken.
  const ownerInUsers = match.ownerId != null && users.some(u => String(u.id) === String(match.ownerId))
  const ownerOptions = [
    ...(ownerInUsers || !match.owner ? [] : [{ value: '__current', label: match.owner, initials: match.ownerInitials || initialsOf(match.owner), disabled: true }]),
    ...users.map(u => ({ value: String(u.id), label: u.name ?? '', initials: initialsOf(u.name) })),
  ]
  // Resolve the picked id back to the full user so the caller can write the name/
  // colour optimistically as well as PATCH the id.
  const handleOwnerChange = (value: string) => {
    if (value === '__current') return
    const user = users.find(u => String(u.id) === value)
    if (user) onSetOwner?.(user)
  }
  // The picker only renders with a real persistence path (§3 no fake affordances):
  // a handler wired AND a live record. Otherwise the owner shows as read-only text.
  const canEditOwner = Boolean(onSetOwner) && !match.archived
  const ownerValue = ownerInUsers ? String(match.ownerId) : (match.owner ? '__current' : null)

  // Tabs are config (§3A). Record history is the changelog ICON-popover in the title row
  // (never a tab) — see titleActions below. Contract/financial reuses drawer.contract.title
  // as its tab label (already translated ×5) instead of a duplicate key.
  const tabs: EntityTab[] = [
    { id: 'overview',  label: t('drawer.tabs.overview'), render: () => <OverviewTab match={match} onSetStatus={onSetStatus} /> },
    { id: 'contract',  label: t('drawer.contract.title'), render: () => <MatchContractSection matchId={match.id} onUpdate={onUpdate} /> },
    { id: 'relations', label: t('drawer.tabs.relations'), render: () => <RelationsTab match={match} /> },
    ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra'), render: () => (
      <CustomFieldsTab entityType="match" values={match.customFieldValues ?? {}}
        onSave={patch => onUpdateCustomFields?.(match.id, patch)} />
    ) }] : []),
    // EXTRACT-1: the shared HelloFlex/Shiftmanager cards, positioned last (§3A/§11).
    // Label comes from the shared common:backofficeLinks.tabLabel key.
    { id: 'koppelingen', label: t('common:backofficeLinks.tabLabel'), render: () => (
      <BackofficeLinksTab entity="matches" id={match.id as Id} helloflexLink={match.helloflexLink} shiftmanagerLink={match.shiftmanagerLink} canLink={canLinkBackoffice} />
    ) },
  ]

  return (
    <EntityDrawer
      entity={{ id: match.id }}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      // Two-sided footer (§3A(8)): created-at left; the right side stays empty —
      // the rejected reason (when applicable) already shows via MatchApprovalActions
      // in the header actions, so it is not duplicated here.
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{t('drawer.createdAt', { date: formatDateTime(match.date) })}</span>
          <span />
        </div>
      }
      header={
        <EntityHeader
          label={t('drawer.label')}
          avatar={{ initials: match.initials, soft: true }}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
          titleActions={<>
            {/* Danny 27-07: the shared house ChangelogPopover shell (§3A(d)) — was a
                cramped 360px dropdown with no focus trap; now the same 900px centred
                panel as the candidate drawer. */}
            <ChangelogPopover><ChangelogTab match={match} /></ChangelogPopover>
            {/* ARCHIVE-1: per-id soft-delete (mirrors candidates' trash icon in the
                title row) — hidden once already archived; the banner below takes over. */}
            {onArchive && !match.archived && (
              <button onClick={() => onArchive(match.id)}
                title={t('drawer.archive')} aria-label={t('drawer.archive')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-danger)', opacity: 0.7 }}>
                <Trash2 size={14} />
              </button>
            )}
          </>}
          renderTitle={() => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{match.candidate}</span>
                {/* Approval badge — colour-coded, read-only, next to the title (§3A calm header). */}
                <MatchApprovalBadge status={match.approval_status} />
                {/* Score sits beside the title (moved out of the old ad-hoc headerChips row). */}
                <ScorePill value={match.score} />
                {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
                <ReferenceNumberChip value={match.referenceNumber} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {[match.vacancy, match.client].filter(v => v && v !== '—').join(' · ') || '—'}
              </div>
            </>
          )}
          // MatchApprovalActions moves into the header actions slot (was the body headerChips row).
          // ARCHIVED: no review action on a soft-deleted match — restore first.
          actions={
            <MatchApprovalActions status={match.approval_status} reason={reason} canUpdate={canApprove && !match.archived} busy={busy}
              rejectOpen={rejectOpen} onOpenReject={() => setRejectOpen(true)} onCancelReject={() => setRejectOpen(false)}
              onApprove={approve} onReject={reject} />
          }
          // Standard meta-picker row (§3A(c)): Status (~160, tenant lookup) + Eigenaar
          // (MATCH-OWNER-1 — a real picker now that PATCH /matches/{id} takes owner_id).
          // ARCHIVED: no status/owner changes on a soft-deleted match — restore first (mirrors candidates).
          meta={[
            ...(onSetStatus && !match.archived ? [{
              key: 'status', label: t('drawer.fields.status'), value: match.status,
              options: matchStatuses.map(s => ({ value: s.value, label: s.label })),
              onChange: onSetStatus, menuWidth: 170, width: 160,
            }] : []),
            ...(canEditOwner ? [{
              key: 'owner', label: t('drawer.fields.owner'), value: ownerValue,
              options: ownerOptions, onChange: handleOwnerChange,
              placeholder: t('drawer.ownerUnassigned'), menuWidth: 200, width: 190,
            }] : []),
          ]}
          // Read-only owner whenever the picker is gated off — the fact stays visible.
          metaExtra={canEditOwner ? undefined : (
            <div style={{ maxWidth: 190 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('drawer.fields.owner')}</div>
              <div style={{ fontSize: 12, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 7,
                background: 'var(--bg)', color: match.owner ? 'var(--text)' : 'var(--text-muted)' }}>
                {match.owner || t('drawer.ownerUnassigned')}
              </div>
            </div>
          )}
        >
          {/* Archived banner (ARCHIVE-1): since-when + restore, right under the header —
              server-backed (mapMatch reads archived/deleted_at, see the type comment on
              MatchRow.archived) OR set locally the moment this session's own archive/
              restore call completes, whichever lands first. */}
          {match.archived && (
            <ArchivedBanner id={match.id}
              message={match.archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(match.archivedAt) }) : t('drawer.archivedBanner.flag')}
              onRestore={onRestore} restoreLabel={t('drawer.archivedBanner.restore')} />
          )}
        </EntityHeader>
      }
      tabs={tabs}
    />
  )
}
