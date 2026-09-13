import type { ReactNode } from 'react'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

interface Props {
  /** The current save-error message, or null when there is none. */
  error: string | null
  /** Called when the Cancel button is clicked. */
  onCancel: () => void
  /** The Cancel button's translated label. */
  cancelLabel: string
  /** Whether the submit button is disabled (the caller computes its own gate). */
  disabled: boolean
  /** Whether a save is in flight — swaps the label for the spinner + busy text. */
  saving: boolean
  /** Translated label shown next to the spinner while saving. */
  busyLabel: ReactNode
  /** Translated label shown on the submit button while idle. */
  idleLabel: ReactNode
}

/**
 * ModalErrorSubmitFooter — the shared error-paragraph + Cancel/Submit row for a
 * <form onSubmit={...}> modal (clone: EditUserModal + NewUserModal). Submit is
 * type="submit" — it never calls a handler itself, so Enter in any field still
 * triggers the host form's own onSubmit; this component only renders the row.
 * SETTINGS-INCON-B2 (13-09): both callers now sit below a two-column card grid
 * (UserModalColumns) and wrapped this in an identical `marginTop: 20` div —
 * the top margin now lives here once instead of copied at both call sites.
 */
export default function ModalErrorSubmitFooter({ error, onCancel, cancelLabel, disabled, saving, busyLabel, idleLabel }: Props) {
  return (
    <div style={{ marginTop: 20 }}>
      {error && <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        <Button type="submit" variant="primary" disabled={disabled}>
          {saving ? <><Spinner size={13} /> {busyLabel}</> : idleLabel}
        </Button>
      </div>
    </div>
  )
}
