/**
 * MatchDrawer — the read-only drill-down for one match, built on the shared
 * EntityDrawer + EntityHeader shell (§3A blueprint). A match is the continuation
 * of an application → placement (§3B), so this drawer only *renders*: no meta
 * pickers, no edit — except the approval workflow (MATCH-APPROVAL-1), which is a
 * calm badge + gated actions, not a picker. Thin container: header config + tab
 * list + the useMatchApproval wiring; all body markup lives in the tab/header
 * components.
 */
import { useTranslation } from 'react-i18next'
import EntityDrawer from '@/components/drawer/EntityDrawer'
import type { EntityTab } from '@/components/drawer/EntityDrawer'
import EntityHeader from '@/components/drawer/EntityHeader'
import StatusPill from '@/components/ui/StatusPill'
import ScorePill from './ScorePill'
import OverviewTab from './drawer/OverviewTab'
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
}

export default function MatchDrawer({
  match, onClose, expanded = false, onToggleExpand, onSetStatus, canApprove = false, onApprovalChange,
}: MatchDrawerProps) {
  const { t } = useTranslation('matches')
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
  // (never a tab) — see titleActions below. A Placement tab waits on a backend detail contract.
  const tabs: EntityTab[] = [
    { id: 'overview',  label: t('drawer.tabs.overview'),  render: () => <OverviewTab match={match} onSetStatus={onSetStatus} /> },
  ]

  return (
    <EntityDrawer
      entity={{ id: match.id }}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
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
