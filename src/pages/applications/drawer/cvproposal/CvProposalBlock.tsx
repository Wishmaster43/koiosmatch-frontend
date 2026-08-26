/**
 * CvProposalBlock — the second CV-parser entry point (CV-PARSER-2, entry b): a
 * CV that arrived WITH a careersite/partner application. Because no human is
 * present at that moment, the parse result is never written onto the candidate —
 * it lands as a proposal here, and a recruiter takes it over or does not.
 *
 * UI states, deliberately asymmetric: the block renders NOTHING while loading and
 * NOTHING when this application has no proposal (the common case — a permanent
 * empty frame on every application would be pure noise, same call as
 * ProposalsBlock), but it DOES render the error state: silently hiding a failed
 * load would hide a pending, unreviewed CV proposal, which is the one thing this
 * feature exists to surface.
 *
 * Nothing here is logged — the proposal payload is special-category personal data (§8).
 */
import { useTranslation } from 'react-i18next'
import SectionCard from '@/components/ui/SectionCard'
import { notifyError, notifySuccess } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { useCvParseProposals } from './useCvParseProposals'
import CvProposalCard from './CvProposalCard'
import type { CvProposalDecision } from './useCvParseProposals'
import type { CvProposal } from '@/pages/applications/data/mapCvProposal'
import type { Id } from '@/types/common'

interface CvProposalBlockProps {
  candidateId: Id | null | undefined
  applicationId: Id | null | undefined
}

// The CV-parser-2 proposal block, with its deliberately asymmetric loading/empty/error rendering.
export default function CvProposalBlock({ candidateId, applicationId }: CvProposalBlockProps) {
  const { t } = useTranslation(['applications', 'common'])
  const {
    proposals, loading, error, currentCandidate, currentLoading, currentError,
    canDecide, decide, deciding, lastDecided,
  } = useCvParseProposals(candidateId, applicationId)

  // No candidate linked → nothing to propose against, and nothing fetched (§8).
  if (candidateId == null) return null

  // Run the decision and report it honestly — a failed accept must never look done.
  const handleDecide = (proposalId: CvProposal['id'], verb: CvProposalDecision) => {
    decide(proposalId, verb)
      .then(() => notifySuccess(verb === 'accept' ? t('cvProposal.accepted') : t('cvProposal.rejected')))
      .catch(err => notifyError(extractApiError(err, t('common:actionFailed'))))
  }

  if (error) {
    return (
      <SectionCard title={t('cvProposal.title')}>
        <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('cvProposal.error')}</div>
      </SectionCard>
    )
  }

  if (loading || proposals.length === 0) return null

  return (
    <SectionCard title={t('cvProposal.title')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {proposals.map(proposal => (
          <CvProposalCard
            key={String(proposal.id)}
            proposal={proposal}
            currentCandidate={currentCandidate}
            currentLoading={currentLoading}
            currentError={currentError}
            canDecide={canDecide}
            deciding={deciding}
            onDecide={handleDecide}
            // The applied/skipped summary only exists on the decision RESPONSE,
            // so it is shown for the proposal that was just decided, never rebuilt.
            decidedResult={lastDecided && String(lastDecided.id) === String(proposal.id) ? lastDecided : null}
          />
        ))}
      </div>
    </SectionCard>
  )
}
