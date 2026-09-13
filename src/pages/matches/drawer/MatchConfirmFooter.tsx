/**
 * MatchConfirmFooter — the cancel/confirm row shared by RenewMatchModal and
 * TerminateMatchModal (same FloatingPanel confirm idiom, G04/MATCH-RENEWAL-1):
 * one secondary Cancel plus one primary or danger confirm button.
 */
import Button from '@/components/ui/Button'

export default function MatchConfirmFooter({ onCancel, cancelLabel, onSubmit, submitLabel, danger = false, disabled = false }: {
  onCancel: () => void
  cancelLabel: string
  onSubmit: () => void
  submitLabel: string
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
      <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
      <Button variant={danger ? 'danger' : 'primary'} onClick={onSubmit} disabled={disabled}>{submitLabel}</Button>
    </div>
  )
}
