/**
 * proposalCv — shared blob helper for the application-proposal CV export. Both the
 * Settings preview (ProposalSettings) and the sibling "propose candidate" modal
 * call this to generate the same PDF via renderCvBlob (@react-pdf, loaded lazily),
 * only varying by contact redaction. Kept DOM-free (no anchor/download logic) so
 * it stays a pure, unit-testable function — the caller owns triggering the
 * browser download.
 */
import type { CvCandidate, CvSettings, TranslateFn } from '@/pages/candidates/shared'

// 'proposal' = redacted (name visible, contact hidden — the default a tenant offers
// when proposing to a customer); 'full' = the unredacted house-style CV.
type ProposalCvVariant = 'proposal' | 'full'

interface BuildProposalCvBlobArgs {
  candidate: CvCandidate
  settings?: CvSettings
  locale?: string
  t?: TranslateFn
  variant: ProposalCvVariant
}

// Render the proposal CV to a Blob; only the 'proposal' variant sets redactContact.
export async function buildProposalCvBlob({ candidate, settings, locale, t, variant }: BuildProposalCvBlobArgs): Promise<Blob> {
  // The PDF engine is loaded on demand so it never lands in a chunk this helper's importers share.
  const { renderCvBlob } = await import('@/pages/candidates/cv/renderCvBlob')
  return renderCvBlob({ c: candidate, settings, locale, t, redactContact: variant === 'proposal' })
}
