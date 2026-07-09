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

export default function MatchApprovalBadge({ status }: { status?: string }) {
  const { t } = useTranslation('matches')
  if (!status) return null
  return <SoftChip label={t(`approval.status.${status}`)} color={APPROVAL_COLOR[status] ?? '#9CA3AF'} round />
}
