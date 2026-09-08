import { LucideIcon } from 'lucide-react'
import { PageTitle } from '@/components/ui/typography'

interface Props {
  // The icon component from lucide-react (e.g. Unlink, XCircle, Send).
  icon: LucideIcon
  // The background color token (e.g. 'var(--color-danger-bg)' or 'var(--color-primary-bg)').
  iconBg: string
  // The text/icon color token (e.g. 'var(--color-on-danger-bg)' or 'var(--color-primary-text)').
  iconColor: string
  // The title text (already translated by the host).
  title: string
  // 600 = the PageTitle identity; 700 where the modal rendered its title bold before the merge (byte-identical DOM).
  titleWeight?: 600 | 700
}

// Shared header for reason-modal dialogs: icon badge + title. All six reason modals
// (DetachReasonModal, RejectionModal, ProposeCandidateModal, RenewMatchModal,
// TerminateMatchModal, OpportunityLostReasonModal) use this single component.
export default function ReasonModalHeader({ icon: Icon, iconBg, iconColor, title, titleWeight = 600 }: Props) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        display: 'inline-flex', width: 30, height: 30, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
        background: iconBg, color: iconColor
      }}>
        <Icon size={16} />
      </span>
      {titleWeight === 700
        ? <PageTitle as="span" style={{ fontWeight: 700 }}>{title}</PageTitle>
        : <PageTitle as="span">{title}</PageTitle>}
    </span>
  )
}
