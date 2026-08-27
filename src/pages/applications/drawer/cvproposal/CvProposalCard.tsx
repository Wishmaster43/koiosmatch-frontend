// CvProposalCard — one CV-parse proposal (pending/accepted/rejected), diffed against
// the candidate's current record, with the accept/reject decision affordance.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, X } from 'lucide-react'
import KoiosAiMark from '@/components/ui/KoiosAiMark'
import SoftChip from '@/components/ui/SoftChip'
import { useConfirm } from '@/hooks/useConfirm'
import { useDateFormat } from '@/lib/datetime'
import { BTN_H } from '@/config/buttonMetrics'
import { buildCvProposalDiff } from '@/pages/applications/data/mapCvProposal'
import { Caption } from '@/components/ui/typography'
import CvProposalDiffTable from './CvProposalDiffTable'
import CvProposalRepeatables from './CvProposalRepeatables'
import type { CvProposal } from '@/pages/applications/data/mapCvProposal'
import type { CvProposalDecision } from './useCvParseProposals'

// Status → semantic token. Pending is a WARNING, not a neutral note: an unread
// proposal means CV data is sitting on this application that nobody checked yet.
const STATUS_COLOR: Record<CvProposal['status'], string> = {
  pending: 'var(--color-warning)',
  accepted: 'var(--color-success)',
  rejected: 'var(--text-muted)',
}

const btnBase = { display: 'inline-flex', alignItems: 'center', gap: 5, height: BTN_H, padding: '0 12px',
  fontSize: 12, fontWeight: 500 as const, borderRadius: 8, cursor: 'pointer' }

interface CvProposalCardProps {
  proposal: CvProposal
  /** The candidate's current record; null while it is still loading or failed. */
  currentCandidate: Record<string, unknown> | null
  currentLoading: boolean
  currentError: boolean
  canDecide: boolean
  deciding: boolean
  onDecide: (proposalId: CvProposal['id'], verb: CvProposalDecision) => void
  /** The accept/reject RESPONSE for this proposal, when it was decided just now. */
  decidedResult: CvProposal | null
}

/**
 * CvProposalCard — one CV-parse proposal on an application.
 *
 * A careersite CV is parsed with NO human present, so nothing was written: this
 * card shows a PROPOSAL and the recruiter decides. Everything here exists to make
 * that decision informed rather than reflexive — the current dossier value next
 * to the CV value, a per-field statement of what accepting would actually do, and
 * a CV badge on every AI-read value because dates and employers are misread often.
 *
 * Accept is all-or-nothing on the API (there is no per-field accept route) and
 * fill-blank-only in CvParseProposalApplier — so we never render a per-field
 * toggle we cannot honour, and we say plainly that filled fields stay untouched.
 */
export default function CvProposalCard({
  proposal, currentCandidate, currentLoading, currentError, canDecide, deciding, onDecide, decidedResult,
}: CvProposalCardProps) {
  const { t } = useTranslation(['applications', 'common'])
  const { formatDateTime } = useDateFormat()
  const { confirm, dialog } = useConfirm()

  // The comparison only exists once the candidate's current values are loaded —
  // without them every field would look empty and promise a fill that never lands.
  const diff = useMemo(
    () => (currentCandidate ? buildCvProposalDiff(proposal, currentCandidate) : null),
    [proposal, currentCandidate],
  )

  const isPending = proposal.status === 'pending'
  const extraRows = proposal.experiences.length + proposal.educations.length
  const hasContent = Object.keys(proposal.scalars).length > 0 || extraRows > 0
  // Accept needs a real comparison in front of the recruiter; without it the
  // button would be a blind write, so it stays disabled (no fake affordance).
  const canAccept = canDecide && !deciding && diff != null

  // Accept/reject both go through the house confirm — the decision is a write on
  // a candidate dossier, never a single stray click.
  const askDecide = (verb: CvProposalDecision) => {
    const message = verb === 'accept'
      ? t('cvProposal.acceptConfirm', { count: diff?.fillCount ?? 0 })
      : t('cvProposal.rejectConfirm')
    confirm(message, () => onDecide(proposal.id, verb), {
      danger: verb === 'reject',
      confirmLabel: verb === 'accept' ? t('cvProposal.accept') : t('cvProposal.reject'),
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header — who produced this and when, plus the decision state. AI-ACT-1:
          the pending state's `cvProposal.intro` line below already names "Koios AI"
          explicitly in visible text, but that line only shows while pending — the
          header mark carries the disclosure hint always, so a decided proposal
          (no intro line) still discloses its AI origin on hover. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <KoiosAiMark size={22} title={t('common:aiGeneratedHint', { defaultValue: 'Door Koios AI gegenereerd — controleer voor gebruik.' })} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('cvProposal.cardTitle')}</span>
        <SoftChip label={t(`cvProposal.status.${proposal.status}`)} color={STATUS_COLOR[proposal.status]} />
        {proposal.createdAt && (
          <Caption>{t('cvProposal.readOn', { date: formatDateTime(proposal.createdAt) })}</Caption>
        )}
        {proposal.model && <Caption>{t('cvProposal.modelLabel', { model: proposal.model })}</Caption>}
      </div>

      {isPending ? (
        <>
          {/* The safety statement, first thing the recruiter reads. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--color-warning-text)' }}>
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{t('cvProposal.intro')}</span>
          </div>

          {/* Four states for the current-values fetch that the diff depends on. */}
          {currentLoading && <Caption as="div">{t('cvProposal.currentLoading')}</Caption>}
          {currentError && (
            <div role="alert" style={{ fontSize: 12, color: 'var(--color-danger-text)' }}>{t('cvProposal.currentError')}</div>
          )}
          {!hasContent && <Caption as="div" style={{ fontStyle: 'italic' }}>{t('cvProposal.noFields')}</Caption>}

          {diff && diff.rows.length > 0 && <CvProposalDiffTable diff={diff} />}
          <CvProposalRepeatables experiences={proposal.experiences} educations={proposal.educations} />

          {/* What accepting does, in one sentence, before the button. */}
          {diff && (
            <Caption as="div">
              {diff.fillCount === 0 && extraRows === 0 ? t('cvProposal.nothingToFill') : t('cvProposal.fillOnlyNotice')}
            </Caption>
          )}
          {extraRows > 0 && <Caption as="div">{t('cvProposal.appendNotice')}</Caption>}
          {/* Key names only — a dropped value is never held, let alone rendered. */}
          {proposal.droppedFieldKeys.length > 0 && (
            <Caption as="div">{t('cvProposal.dropped', { count: proposal.droppedFieldKeys.length })}</Caption>
          )}
          <Caption as="div" style={{ fontStyle: 'italic' }}>{t('cvProposal.noFreeText')}</Caption>

          {/* The decision. Read-only viewers get an honest line, not a dead button. */}
          {canDecide ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => askDecide('accept')} disabled={!canAccept}
                style={{ ...btnBase, border: '1px solid var(--color-primary)',
                  background: canAccept ? 'var(--color-primary-bg)' : 'none',
                  color: 'var(--color-primary-text)', cursor: canAccept ? 'pointer' : 'not-allowed',
                  opacity: canAccept ? 1 : 0.6 }}>
                <Check size={13} /> {t('cvProposal.accept')}
              </button>
              {/* BUTTON-SOFT-TINT-1 (Danny 05-08): was a white/transparent outline
                  button — now the house soft-tint recipe (§4). */}
              <button type="button" onClick={() => askDecide('reject')} disabled={deciding}
                style={{ ...btnBase, border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
                  background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                  color: 'var(--color-danger-text)', cursor: deciding ? 'not-allowed' : 'pointer',
                  opacity: deciding ? 0.6 : 1 }}>
                <X size={13} /> {t('cvProposal.reject')}
              </button>
            </div>
          ) : (
            <Caption as="div">{t('cvProposal.readOnly')}</Caption>
          )}
        </>
      ) : (
        <>
          {/* Decided — who and when, then what actually landed (accept only). */}
          <Caption as="div">
            {proposal.reviewedBy
              ? t('cvProposal.reviewedBy', { name: proposal.reviewedBy, date: proposal.reviewedAt ? formatDateTime(proposal.reviewedAt) : '—' })
              : t('cvProposal.reviewedOn', { date: proposal.reviewedAt ? formatDateTime(proposal.reviewedAt) : '—' })}
          </Caption>
          {proposal.status === 'accepted' && decidedResult && (
            <Caption as="div">
              {decidedResult.appliedFields.length === 0
                ? t('cvProposal.resultNothing')
                : t('cvProposal.resultApplied', { count: decidedResult.appliedFields.length })}
              {decidedResult.skippedFields.length > 0 && ` · ${t('cvProposal.resultSkipped', { count: decidedResult.skippedFields.length })}`}
            </Caption>
          )}
        </>
      )}
      {dialog}
    </div>
  )
}
