/**
 * MatchApprovalBadge — the colour-coded approval status chip shown next to the
 * match drawer title (§3A calm header: a read-only badge, not a wall of pickers).
 * Purely presentational; MatchDrawer wires the data via useMatchApproval and
 * renders the interactive bits (approve/reject) separately in MatchApprovalActions.
 */
import { useTranslation } from 'react-i18next'
import SoftChip from '@/components/ui/SoftChip'

// One colour per approval state — warning/success/danger tokens (§4 soft-chip convention).
const APPROVAL_COLOR: Record<string, string> = {
  pending: 'var(--color-warning)',
  approved: 'var(--color-success)',
  rejected: 'var(--color-danger)',
}

interface MatchApprovalBadgeProps {
  status?: string
  // goedkeuring-badge-eerlijk (08-08): the tenant's approval_mode setting (via
  // useMatchApprovalMode in MatchDrawer) — undefined while it is still loading,
  // or when a caller doesn't wire it at all (see the gate below for what that means).
  approvalMode?: string
}

// Read-only approval-status chip; hidden when a bare "approved" would be a
// constant rather than real information (see the honesty-gate comment below).
export default function MatchApprovalBadge({ status, approvalMode }: MatchApprovalBadgeProps) {
  const { t } = useTranslation('matches')
  if (!status) return null
  // Honesty gate (goedkeuring-badge-eerlijk, 08-08): with approval_mode 'uit' a new
  // match always defaults to 'approved' and NOTHING can ever move it off that value —
  // so a bare "Approved" badge is a constant, not information, and must stay hidden.
  // Show the badge when either (a) the mode genuinely gates something (anything but
  // 'uit'), or (b) the match itself already IS informative regardless of the current
  // mode — pending/rejected are real outcomes, never hidden even if approval was
  // switched off afterwards. When approvalMode is unresolved (still loading, or a
  // caller that never wires useMatchApprovalMode at all) this falls back to gating on
  // the match's own state alone: pending/rejected still show, an unproven "approved"
  // stays hidden rather than risk showing noise.
  const informative = status !== 'approved' || (approvalMode !== undefined && approvalMode !== 'uit')
  if (!informative) return null
  // DD-FE-5/M2 (08-08, DRILL-DOWN-CONSISTENCY): this badge sits right beside the
  // header's separate Status picker (the operational `status`, e.g. "Open") — a bare
  // "Goedgekeurd" next to it read as a second, contradictory status rather than its
  // own axis. Relabelling (prefixing the badge with its own axis name) was chosen
  // over moving it out of the title row: §3A's calm-header rule wants ONE read-only
  // badge next to the title, not a wall of pickers, so keeping it there — just
  // naming what it is — stays closer to the blueprint than relocating it.
  const label = t('approval.badgeWithLabel', { label: t('approval.badgeLabel'), status: t(`approval.status.${status}`) })
  // eslint-disable-next-line no-restricted-syntax -- DATA fallback for an unmapped status, not a UI colour choice (mirrors Avatar.tsx's identical constant)
  return <SoftChip label={label} color={APPROVAL_COLOR[status] ?? '#9CA3AF'} round />
}
