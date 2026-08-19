/**
 * MatchDrawer — the drill-down for one match, built on the shared EntityDrawer +
 * EntityHeader shell (§3A blueprint). The match facts (candidate/vacancy/client/
 * score/stage) stay read-only — a match is the continuation of a Hired
 * application (§3B) and those are derived — but the match's contract/financial
 * layer IS editable in-place. Content tabs: Overzicht (facts/score/status,
 * PLUS the candidate/vacancy/klant relation hyperlinks and the MATCH-ORDINAL-1
 * footnote that used to live on their own Relaties tab — M9 of the
 * overzicht-layout cluster folded that tab's whole content into Overview and
 * removed it, so ALL match information now lives on one tab), Contract &
 * financieel (MatchContractSection, moved as-is) and
 * Notities (NT-MATCH-1, 2026-08-04 — MatchNoteController now exists, so the
 * placeholder note above about "no /matches/{id}/notes route yet" no longer
 * applies). ChangelogTab stays the icon-popover, never a tab (§3A(d)). Header
 * meta row (DRAWER-STD-1, 2026-07-14): a standard Status picker (the same
 * /match-statuses lookup the board/table use, ~160) + a real Eigenaar picker
 * (MATCH-OWNER-1, 2026-07-31) — PATCH /matches/{id} accepts `owner_id`
 * (UpdateMatchRequest → PlacementRules trait, tenant-validated), so reassigning
 * persists like every other entity. A "Beëindigen" header action
 * (MATCH-TERMINATE-1, 2026-08-04) opens TerminateMatchModal, which POSTs
 * /matches/{id}/terminate and hands the updated match back through onUpdate —
 * hidden once the match's status already carries the tenant's is_closed flag,
 * or once archived. A "Verlengen" header action (G04/MATCH-RENEWAL-1,
 * 2026-08-08) opens RenewMatchModal, which POSTs /matches/{id}/renew and hands
 * the updated match back the same way — visible whenever the permission is
 * there, but DISABLED with an honest reason once closed/archived (unlike
 * terminate's hide-outright, per G04: "disabled with a reason where the BE
 * refuses" is the more informative choice for an already-ended match). Thin
 * container: header config + tab list + the useMatchApproval wiring; all body
 * markup lives in the tab/header components.
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Ban, RefreshCw } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import type { EntityTab } from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import PendingEraseBanner from '@/components/drawer/PendingEraseBanner'
import { buildTrashNote } from '@/hooks/useTrashFlow'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import BackofficeLinksTab from '@/components/drawer/BackofficeLinksTab'
import { useBackofficeLinksVisible } from '@/components/drawer/useBackofficeLinksVisible'
import { useDateFormat } from '@/lib/datetime'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useCustomFields } from '@/lib/useCustomFields'
import { useUsers } from '@/lib/queries'
import { initialsOf } from '@/lib/initials'
import ScorePill from './ScorePill'
import OverviewTab from './drawer/OverviewTab'
import MatchContractSection from './drawer/MatchContractSection'
import NotesTab from './drawer/NotesTab'
import TerminateMatchModal from './drawer/TerminateMatchModal'
import RenewMatchModal from './drawer/RenewMatchModal'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import ChangelogTab from './drawer/ChangelogTab'
import MatchApprovalBadge from './drawer/MatchApprovalBadge'
import MatchApprovalActions from './drawer/MatchApprovalActions'
import { useMatchApproval } from './hooks/useMatchApproval'
import { useMatchApprovalMode } from './hooks/useMatchApprovalMode'
import { computeMatchOrdinals } from './matchOrdinals'
import type { OwnerCandidate } from './hooks/useMatchMutations'
import type { MatchRow } from '@/types/match'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'
import EntityLink from '@/components/ui/EntityLink'

interface MatchDrawerProps {
  match: MatchRow | null
  // MATCH-ORDINAL-1 (M14/M15): the full tenant match set (useMatches' `rows`),
  // used only to compute this match's ordinal position per axis — never rendered
  // as a list. Omitting it just hides the ordinal footnote (now on OverviewTab, M9).
  allRows?: MatchRow[]
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
  // TRASH-OVERAL-2: mark for erasure (matches.delete — HIDDEN without it) opens the
  // shared preview modal at the page; unmark (matches.update) leaves the trash again.
  onMarkDeletion?: (id: MatchRow['id']) => void
  onUnmark?: (id: MatchRow['id']) => void
  // Tenant grace window (useTrashFlow.graceDays) — feeds the trash banner's erase note.
  graceDays?: number | null
  // EXTRACT-1: the caller's own matches.update permission check for the
  // Koppelingen tab's "Koppelen" buttons (§7 — UI gate, backend re-checks).
  canLinkBackoffice?: boolean
  // MATCH-TERMINATE-1: same matches.update gate as the sibling actions (§7 —
  // UI-only; POST /matches/{id}/terminate re-checks server-side).
  canTerminate?: boolean
  // G04/MATCH-RENEWAL-1: same matches.update gate as terminate (§7 — UI-only;
  // POST /matches/{id}/renew re-checks server-side).
  canRenew?: boolean
}

export default function MatchDrawer({
  match, allRows = [], onClose, expanded = false, onToggleExpand, onSetStatus, onSetOwner, canApprove = false, onApprovalChange, onUpdate, onUpdateCustomFields,
  onArchive, onRestore, onMarkDeletion, onUnmark, graceDays = null, canLinkBackoffice = false, canTerminate: canTerminatePermission = false, canRenew: canRenewPermission = false,
}: MatchDrawerProps) {
  const { t } = useTranslation('matches')
  const { formatDate, formatDateTime } = useDateFormat()
  // Approval data/actions live in one hook here (thin container, §3) — the header
  // pieces below stay presentational.
  const { reason, busy, rejectOpen, setRejectOpen, approve, reject } = useMatchApproval(match, onApprovalChange)
  // goedkeuring-badge-eerlijk (08-08): the tenant's approval_mode setting — feeds
  // MatchApprovalBadge's honesty gate (an "Approved" badge is noise when approval
  // is switched off, since every match then defaults to approved with no way off it).
  const { approvalMode } = useMatchApprovalMode()
  // R-1b lifecycle status — the same tenant lookup the board/table use. metaOf
  // also drives the terminate button's is_closed gate below (MATCH-TERMINATE-1).
  const { statuses: matchStatuses, metaOf: matchStatusMeta } = useMatchStatuses()
  // The Extra tab only shows when the tenant has defined match custom fields (§3A(f)).
  const { fields: customFieldDefs } = useCustomFields('match')
  // DD-FE-6 ("no empty tabs"): this file passes no extra children into
  // BackofficeLinksTab, so the Koppelingen tab is genuinely empty (no card, no
  // "Koppelen" button) unless at least one connector app is enabled.
  const showKoppelingen = useBackofficeLinksVisible()
  // MATCH-OWNER-1: the tenant's users, the owner picker's options (cached app-wide).
  const { data: users = [] } = useUsers() as { data?: OwnerCandidate[] }
  // MATCH-TERMINATE-1: the "Beëindigen" confirm modal, opened from the header action below.
  const [terminateOpen, setTerminateOpen] = useState(false)
  // G04/MATCH-RENEWAL-1: the "Verlengen" confirm modal, opened from the header action below.
  const [renewOpen, setRenewOpen] = useState(false)
  // MATCH-ORDINAL-1 (M14/M15): this match's position among the tenant's other
  // matches per axis — computed once per (match, allRows) change, not per render.
  const ordinals = useMemo(() => computeMatchOrdinals(allRows, match), [allRows, match])
  if (!match) return null

  // The button hides once the match is already closed (its status carries the
  // is_closed flag — R-1b) or already archived (soft-deleted, restore first —
  // mirrors every other header action in this drawer). The list row itself
  // never carries an is_closed flag (only the status slug does), so this
  // derives it from the same /match-statuses lookup the header's own Status
  // picker already loads, rather than a second fetch.
  const matchIsClosed = Boolean(matchStatusMeta(match.status)?.is_closed)
  const canTerminate = canTerminatePermission && !match.archived && !matchIsClosed
  // TRASH-OVERAL-2: parked in the trash awaiting automatic erasure — the danger
  // banner + unmark take over from the archived banner/restore below.
  const inTrash = match.lifecycle === 'pending_erase'

  // G04/MATCH-RENEWAL-1: unlike terminate, the renew button stays VISIBLE whenever
  // the permission is there — but DISABLED with an honest reason once the match is
  // already closed or archived, i.e. the backend would refuse it (a renewal can
  // only push end_date forward on a live match). No fake affordance: the click
  // handler below only opens the modal when there is no reason.
  const renewDisabledReason = match.archived
    ? t('drawer.renew.disabledArchived')
    : matchIsClosed
      ? t('drawer.renew.disabledClosed')
      : undefined
  const canRenew = canRenewPermission

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
    // M9 (overzicht-layout): Overview now carries the relation hyperlinks + the
    // ordinal footnote too — the whole match, one tab.
    // REMARKS-INTO-NOTES-1: the shell hands each tab its own setActiveTab, so the
    // retired Opmerkingen block can jump to Notes right after moving its text there.
    { id: 'overview',  label: t('drawer.tabs.overview'), render: setTab => <OverviewTab match={match} onSetStatus={onSetStatus} onUpdate={onUpdate} ordinals={ordinals} onOpenNotes={() => setTab?.('notes')} /> },
    { id: 'contract',  label: t('drawer.contract.title'), render: () => <MatchContractSection matchId={match.id} onUpdate={onUpdate} /> },
    // NT-MATCH-1: notes, after the content tabs above and before Extra/Koppelingen
    // (there is no Changelog TAB — record history stays the icon-popover, §3A(d)).
    { id: 'notes', label: t('notes.title'), render: () => <NotesTab match={match} /> },
    ...(customFieldDefs.length > 0 ? [{ id: 'extra', label: t('drawer.tabs.extra'), render: () => (
      <CustomFieldsTab entityType="match" values={match.customFieldValues ?? {}}
        onSave={patch => onUpdateCustomFields?.(match.id, patch)} />
    ) }] : []),
    // EXTRACT-1: the shared HelloFlex/Shiftmanager cards, positioned last (§3A/§11).
    // Label comes from the shared common:backofficeLinks.tabLabel key. DD-FE-6
    // ("no empty tabs"): only listed when a connector app is enabled — otherwise
    // the tab body would render nothing (no card, no "Koppelen" button).
    ...(showKoppelingen ? [{ id: 'koppelingen', label: t('common:backofficeLinks.tabLabel'), render: () => (
      <BackofficeLinksTab entity="matches" id={match.id as Id} helloflexLink={match.helloflexLink} shiftmanagerLink={match.shiftmanagerLink} canLink={canLinkBackoffice} />
    ) }] : []),
  ]

  return (
    <>
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
          // TITEL-CHIP-1 (Danny 19-08): the title slot carries the CUSTOMER as a
          // deep link (EntityLink brings the new-tab icon); falls back to the
          // static entity word when the match has no customer.
          label={match.clientId != null
            ? <EntityLink page="customers" id={match.clientId}>{match.client || t('drawer.label')}</EntityLink>
            : t('drawer.label')}
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
            {/* TRASH-OVERAL-2: archived → trash (matches.delete-gated at the page; the
                shared preview modal confirms). Hidden once already in the trash. */}
            {onMarkDeletion && match.archived && !inTrash && (
              <button onClick={() => onMarkDeletion(match.id)}
                title={t('common:trash.markAction')} aria-label={t('common:trash.markAction')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--color-danger)' }}>
                <Trash2 size={14} />
              </button>
            )}
          </>}
          renderTitle={() => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{match.candidate}</span>
                {/* Approval badge — colour-coded, read-only, next to the title (§3A calm header).
                    Only rendered when it means something (goedkeuring-badge-eerlijk) — see the gate in MatchApprovalBadge. */}
                <MatchApprovalBadge status={match.approval_status} approvalMode={approvalMode} />
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
            <>
              <MatchApprovalActions status={match.approval_status} reason={reason} canUpdate={canApprove && !match.archived} busy={busy}
                rejectOpen={rejectOpen} onOpenReject={() => setRejectOpen(true)} onCancelReject={() => setRejectOpen(false)}
                onApprove={approve} onReject={reject} />
              {/* G04/MATCH-RENEWAL-1 — house Button on the sm standard (PRIMAIR-VLAK-1):
                  accent action = the button trio; stays visible but DISABLED with a
                  title/reason once closed or archived (no fake affordance). */}
              {canRenew && (
                <Button variant="soft" size="sm" onClick={() => !renewDisabledReason && setRenewOpen(true)}
                  disabled={Boolean(renewDisabledReason)}
                  title={renewDisabledReason} aria-label={renewDisabledReason || t('drawer.renew.button')}>
                  <RefreshCw size={11} />{t('drawer.renew.button')}
                </Button>
              )}
              {/* MATCH-TERMINATE-1 — destructive stays the danger language (dangerSoft),
                  Danny's explicit exclusion from the tenant fill; hidden once closed. */}
              {canTerminate && (
                <Button variant="dangerSoft" size="sm" onClick={() => setTerminateOpen(true)}>
                  <Ban size={11} />{t('drawer.terminate.button')}
                </Button>
              )}
            </>
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
          {match.archived && !inTrash && (
            <ArchivedBanner id={match.id}
              message={match.archivedAt ? t('drawer.archivedBanner.since', { date: formatDate(match.archivedAt) }) : t('drawer.archivedBanner.flag')}
              onRestore={onRestore} restoreLabel={t('drawer.archivedBanner.restore')} />
          )}
          {/* TRASH-OVERAL-2: trash state — since-when + projected erase moment
              (DD-MM-YYYY via the house formatter) + the unmark ("back to archive")
              action, matches.update-gated at the page. */}
          {inTrash && (
            <PendingEraseBanner id={match.id}
              message={buildTrashNote(t, formatDate, match.pendingEraseAt, graceDays)}
              onUnmark={onUnmark ? () => onUnmark(match.id) : undefined}
              unmarkLabel={t('common:trash.unmarkAction')} />
          )}
        </EntityHeader>
      }
      tabs={tabs}
    />
    {/* MATCH-TERMINATE-1: mounted only while open — mirrors the reject-reason
        prompt pattern (a fresh mount per open keeps useFocusTrap correct). */}
    {terminateOpen && (
      <TerminateMatchModal match={match} onClose={() => setTerminateOpen(false)} onUpdate={onUpdate} />
    )}
    {/* G04/MATCH-RENEWAL-1: same mounted-only-while-open idiom as terminate. */}
    {renewOpen && (
      <RenewMatchModal match={match} onClose={() => setRenewOpen(false)} onUpdate={onUpdate} />
    )}
    </>
  )
}
