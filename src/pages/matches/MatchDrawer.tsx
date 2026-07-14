/**
 * MatchDrawer — the drill-down for one match, built on the shared EntityDrawer +
 * EntityHeader shell (§3A blueprint). The match facts (candidate/vacancy/client/
 * score/stage) stay read-only — a match is the continuation of an application →
 * placement (§3B) and those are derived — but the placement's contract/financial
 * layer IS editable in-place. Three real tabs (Danny, 2026-07-14: "ook tabjes maken
 * voor de drill down" — one tab used to wear the summary + the whole contract form
 * at once): Overzicht (facts/score/status), Contract & financieel
 * (MatchContractSection, moved as-is), Relaties (candidate/vacancy/klant, each a
 * cross-entity hyperlink — RelationsTab). A Notities/Tijdlijn tab is NOT added: the
 * backend has no /matches/{id}/notes or .../activity route yet (grepped
 * routes/api/tenant/applications-matches.php — only CRUD + approve/reject/contract
 * exist), so ChangelogTab stays the icon-popover it already was rather than a fake
 * tab. The header itself stays calm: no meta pickers, only the approval workflow
 * badge/actions (MATCH-APPROVAL-1). Thin container: header config + tab list + the
 * useMatchApproval wiring; all body markup lives in the tab/header components.
 */
import { useTranslation } from 'react-i18next'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import type { EntityTab } from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import ReferenceNumberChip from '@/components/ui/ReferenceNumberChip'
import { useDateFormat } from '@/lib/datetime'
import StatusPill from '@/components/ui/StatusPill'
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
}

export default function MatchDrawer({
  match, onClose, expanded = false, onToggleExpand, onSetStatus, canApprove = false, onApprovalChange, onUpdate,
}: MatchDrawerProps) {
  const { t } = useTranslation('matches')
  const { formatDateTime } = useDateFormat()
  // Approval data/actions live in one hook here (thin container, §3) — the header
  // pieces below stay presentational.
  const { reason, busy, rejectOpen, setRejectOpen, approve, reject } = useMatchApproval(match, onApprovalChange)
  if (!match) return null

  // Read-only chip row shown under the title (score · stage · owner · approval actions).
  const headerChips = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <ScorePill value={match.score} />
        {match.stage && <StatusPill label={match.stage} color={match.stageColor} />}
        {match.owner && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{match.owner}</span>}
      </div>
      <MatchApprovalActions status={match.approval_status} reason={reason} canUpdate={canApprove} busy={busy}
        rejectOpen={rejectOpen} onOpenReject={() => setRejectOpen(true)} onCancelReject={() => setRejectOpen(false)}
        onApprove={approve} onReject={reject} />
    </div>
  )

  // Tabs are config (§3A). Record history is the changelog ICON-popover in the title row
  // (never a tab) — see titleActions below. Contract/financial reuses drawer.contract.title
  // as its tab label (already translated ×5) instead of a duplicate key.
  const tabs: EntityTab[] = [
    { id: 'overview',  label: t('drawer.tabs.overview'), render: () => <OverviewTab match={match} onSetStatus={onSetStatus} /> },
    { id: 'contract',  label: t('drawer.contract.title'), render: () => <MatchContractSection matchId={match.id} onUpdate={onUpdate} /> },
    { id: 'relations', label: t('drawer.tabs.relations'), render: () => <RelationsTab match={match} /> },
  ]

  return (
    <EntityDrawer
      entity={{ id: match.id }}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
      // Footer — created-at only (mirrors CandidateDrawer's footer; no obvious
      // right-side equivalent for a match, so just the left-side line).
      footer={
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {t('drawer.createdAt', { date: formatDateTime(match.date) })}
        </div>
      }
      header={
        <EntityHeader
          label={t('drawer.label')}
          avatar={{ initials: match.initials, soft: true }}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onClose={onClose}
          titleActions={<MatchChangelogPopover match={match} />}
          renderTitle={() => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{match.candidate}</span>
                {/* Approval badge — colour-coded, read-only, next to the title (§3A calm header). */}
                <MatchApprovalBadge status={match.approval_status} />
                {/* NUMMER-1: human-readable reference number, click-to-copy — same spot on every drawer. */}
                <ReferenceNumberChip value={match.referenceNumber} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {[match.vacancy, match.client].filter(v => v && v !== '—').join(' · ') || '—'}
              </div>
            </>
          )}
        >
          {headerChips}
        </EntityHeader>
      }
      tabs={tabs}
    />
  )
}
