import type { ReactNode } from 'react'
import Button from '@/components/ui/Button'

interface Props {
  onCancel: () => void
  cancelLabel: string
  /** The caller's own click handler (already wired to its own trimmed-reason guard). */
  onConfirmClick: () => void
  confirmDisabled: boolean | undefined
  /** The confirm button's content — a static label, or the caller's own busy/idle swap. */
  confirmContent: ReactNode
}

/**
 * ReasonPromptFooter — the shared Cancel/Confirm(danger) row for a short
 * reason-collecting confirm prompt (clone: DetachReasonModal + DetachApplicationModal).
 * Labels/content arrive already resolved from the caller's own t().
 */
export default function ReasonPromptFooter({ onCancel, cancelLabel, onConfirmClick, confirmDisabled, confirmContent }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
      <Button variant="secondary" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button variant="danger" onClick={onConfirmClick} disabled={confirmDisabled}>
        {confirmContent}
      </Button>
    </div>
  )
}
