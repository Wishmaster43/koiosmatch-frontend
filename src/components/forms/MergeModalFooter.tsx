import { GitMerge } from 'lucide-react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

interface Props {
  /** Whether the Back button renders at all (once a candidate/duplicate is picked). */
  showBack: boolean
  onBack: () => void
  /** Disables Back while a merge is in flight — only MergeCandidateModal does this
      (the others never disable Back), so it stays an explicit opt-in. */
  backDisabled?: boolean
  backLabel: string
  onCancel: () => void
  cancelLabel: string
  onConfirm: () => void
  confirmDisabled: boolean
  /** Swaps the confirm icon for a spinner while the merge request is in flight. */
  busy: boolean
  confirmLabel: string
}

/**
 * MergeModalFooter — the shared back/cancel/confirm row every merge modal ends
 * with (clone: MergeCandidateModal + MergeCustomerModal + MergeEntityModal).
 * All labels arrive already translated from the caller's own t()/tk().
 */
export default function MergeModalFooter({
  showBack, onBack, backDisabled = false, backLabel,
  onCancel, cancelLabel, onConfirm, confirmDisabled, busy, confirmLabel,
}: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      {showBack
        ? <Button variant="secondary" size="sm" onClick={onBack} disabled={backDisabled}>
            {backLabel}
          </Button>
        : <span />}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm} disabled={confirmDisabled}>
          {busy ? <Spinner size={13} /> : <GitMerge size={13} />} {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
