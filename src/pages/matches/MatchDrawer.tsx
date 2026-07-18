/**
 * MatchDrawer — the drill-down for one match, built on the shared EntityDrawer +
 * EntityHeader shell (§3A blueprint). The match facts (candidate/vacancy/client/
 * score/stage) stay read-only — a match is the continuation of an application →
 * placement (§3B) and those are derived — but the placement's contract/financial
 * layer IS editable in-place. Three real tabs (Danny, 2026-07-14: "ook tabjes maken
 * voor de drill down" — one tab used to wear the summary + the whole contract form
 * at once): Overzicht (facts/score/status), Contract & financieel
 * (MatchContractSection, moved as-is), Relaties (candidate/vacancy/klant, each a
 * cross-entity hyperlink — RelationsTab). A Notities tab is NOT added: the
 * backend has no /matches/{id}/notes route yet (grepped
 * routes/api/tenant/applications-matches.php — only CRUD + approve/reject/contract
 * exist), so ChangelogTab stays the icon-popover it already was rather than a fake
 * tab. Header meta row (DRAWER-STD-1, 2026-07-14): a standard Status picker (the
 * same /match-statuses lookup the board/table use, ~160) + Eigenaar. UpdateMatchRequest
 * does not accept owner_id (MATCH-OWNER-1 — grepped app/Http/Requests/JobMatch), so
 * the owner is a read-only labelled value, not a picker, until that lands. Thin
 * container: header config + tab list + the useMatchApproval wiring; all body markup
 * lives in the tab/header components.
 */
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import type { EntityTab } from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ArchivedBanner from '@/components/drawer/ArchivedBanner'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import CustomFieldsTab from '@/components/drawer/CustomFieldsTab'
import { useDateFormat } from '@/lib/datetime'
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useCustomFields } from '@/lib/useCustomFields'
import ScorePill from './ScorePill'
import OverviewTab from './drawer/OverviewTab'
import RelationsTab from './drawer/RelationsTab'
import MatchContractSection from './drawer/MatchContractSection'
import MatchChangelogPopover from './drawer/MatchChangelogPopover'
import MatchApprovalBadge from './drawer/MatchApprovalBadge'
import MatchApprovalActions from './drawer/MatchApprovalActions'
import { useMatchApproval } from './hooks/useMatchApproval'
import type { MatchRow } from '@/types/match'

interface MatchDrawerProps {
  match: MatchRow | null
  onClose: () => void
  expanded?: boolean
  onToggleExpand?: () => void
  // R-1b: change the lifecycle status (lookup-driven); omitting keeps the tab read-only.
  onSetStatus?: (status: string) => void
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
}

export default function MatchDrawer({
  match, onClose, expanded = false, onToggleExpand, onSetStatus, canApprove = false, onApprovalChange, onUpdate, onUpdateCustomFields,
  onArchive, onRestore,
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
  if (!match) return null

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
            <MatchChangelogPopover match={match} />
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
          // ARCHIVED: no review action on a soft-deleted placement — restore first.
          actions={
            <MatchApprovalActions status={match.approval_status} reason={reason} canUpdate={canApprove && !match.archived} busy={busy}
              rejectOpen={rejectOpen} onOpenReject={() => setRejectOpen(true)} onCancelReject={() => setRejectOpen(false)}
              onApprove={approve} onReject={reject} />
          }
          // Standard meta-picker row (§3A(c)): Status (~160, tenant lookup) + Eigenaar.
          // Eigenaar stays a read-only labelled value — UpdateMatchRequest has no
          // owner_id field yet (MATCH-OWNER-1), so a picker would silently no-op.
          // ARCHIVED: no status changes on a soft-deleted placement — restore first (mirrors candidates).
          meta={onSetStatus && !match.archived ? [
            { key: 'status', label: t('drawer.fields.status'), value: match.status,
              options: matchStatuses.map(s => ({ value: s.value, label: s.label })),
              onChange: onSetStatus, menuWidth: 170, width: 160 },
          ] : []}
          metaExtra={
            <div style={{ maxWidth: 190 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{t('drawer.fields.owner')}</div>
              <div style={{ fontSize: 12, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 7,
                background: 'var(--bg)', color: match.owner ? 'var(--text)' : 'var(--text-muted)' }}>
                {match.owner || '—'}
              </div>
            </div>
          }
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
