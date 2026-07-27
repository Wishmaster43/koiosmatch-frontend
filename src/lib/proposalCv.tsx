/**
 * proposalCv — shared blob helper for the application-proposal CV export. Both the
 * Settings preview (ProposalSettings) and the sibling "propose candidate" modal
 * call this to generate the same PDF via @react-pdf/renderer's `pdf().toBlob()`,
 * only varying by contact redaction. Kept DOM-free (no anchor/download logic) so
 * it stays a pure, unit-testable function — the caller owns triggering the
 * browser download.
 */
import { pdf } from '@react-pdf/renderer'
import { CvDocument } from '@/pages/candidates/CandidateCvTemplate'
import type { CvCandidate, CvSettings, TranslateFn } from '@/pages/candidates/CandidateCvTemplate'

// 'proposal' = redacted (name visible, contact hidden — the default a tenant offers
// when proposing to a customer); 'full' = the unredacted house-style CV.
export type ProposalCvVariant = 'proposal' | 'full'

export interface BuildProposalCvBlobArgs {
  candidate: CvCandidate
  settings?: CvSettings
  locale?: string
  t?: TranslateFn
  variant: ProposalCvVariant
}

// Render the proposal CV to a Blob; only the 'proposal' variant sets redactContact.
export async function buildProposalCvBlob({ candidate, settings, locale, t, variant }: BuildProposalCvBlobArgs): Promise<Blob> {
  return pdf(
    <CvDocument c={candidate} settings={settings} locale={locale} t={t} redactContact={variant === 'proposal'} />,
  ).toBlob()
}
