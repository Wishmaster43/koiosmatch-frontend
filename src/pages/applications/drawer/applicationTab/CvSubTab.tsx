/**
 * CvSubTab — APP-TAB-SPLIT-1, group (c): every CV-themed block, in the
 * original relative order — the linked candidate's current CV (CvBlock), a CV
 * that arrived WITH this application awaiting review (CvProposalBlock,
 * CV-PARSER-2 entry b) and the recorded-proposal history sent to clients
 * (ProposalsBlock, PROPOSE-STORE-1). All three already honest-gate their own
 * loading/empty/error states, unchanged here.
 */
import CvBlock from '../CvBlock'
import CvProposalBlock from '../cvproposal/CvProposalBlock'
import ProposalsBlock from '../propose/ProposalsBlock'
import type { ApplicationDetail } from '@/types/application'

interface CvSubTabProps { application: ApplicationDetail }

export default function CvSubTab({ application: a }: CvSubTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* S31: the linked candidate's CV at a glance — file name + upload date. */}
      <CvBlock candidateId={a.candidateId} />
      {/* CV-PARSER-2 (entry b): the CV that came in WITH this application, parsed
          into a PROPOSAL nobody wrote to the dossier — hidden entirely until
          such a proposal exists. */}
      <CvProposalBlock candidateId={a.candidateId} applicationId={a.id} />
      {/* PROPOSE-STORE-1: the recorded-proposal history (recipient, cv variant,
          sent/opened/revoked state) — hidden entirely until at least one exists. */}
      <ProposalsBlock application={a} />
    </div>
  )
}
