/**
 * ApplicationBucketBadge — the colour-coded, read-only OUTCOME chip shown next
 * to the application drawer title (§3A calm header: a badge, not a wall of
 * pickers; mirrors MatchApprovalBadge). Derives its label/colour from the
 * application's `bucket` (active/matched/rejected — flag-derived via
 * bucketOfPhase, never a hardcoded funnel stage key, A1) so a tenant renaming
 * its funnel stages never breaks it.
 *
 * Distinct from the Fase meta picker below it in the header: the picker shows
 * the granular funnel STAGE (e.g. "Voorstel gedaan"), this badge shows the
 * coarser three-way OUTCOME bucket that stage rolls up into — it is not the
 * phase badge S4 removed for duplicating the picker (that showed the same
 * stage twice; this shows a different, derived axis).
 */
import { useTranslation } from 'react-i18next'
import SoftChip from '@/components/ui/SoftChip'

// One colour per outcome bucket — primary/success/danger tokens (§4 soft-chip convention).
const BUCKET_COLOR: Record<string, string> = {
  active: 'var(--color-primary)',
  matched: 'var(--color-success)',
  rejected: 'var(--color-danger)',
}

export default function ApplicationBucketBadge({ bucket }: { bucket?: string }) {
  const { t } = useTranslation('applications')
  if (!bucket) return null
  return <SoftChip label={t(`buckets.${bucket}`)} color={BUCKET_COLOR[bucket] ?? '#9CA3AF'} round />
}
