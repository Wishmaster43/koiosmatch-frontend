import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface ConfirmDeleteState {
  kind: 'one' | 'many'
}

interface DocumentDeleteDialogProps {
  open: ConfirmDeleteState | null
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmLabel: string
}

/** Shared document delete confirmation dialog for the candidates, customers and
 * vacancies documents tabs. Wraps ConfirmDialog; every string is translated by
 * the caller's own t() and passed in, so the unit carries no i18n dependency.
 */
export default function DocumentDeleteDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel,
}: DocumentDeleteDialogProps) {
  return (
    <ConfirmDialog
      open={!!open}
      danger
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
