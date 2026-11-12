import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface ConfirmDeleteState {
  kind: 'one' | 'many'
}

interface DocumentDeleteDialogProps {
  open: ConfirmDeleteState | null
  onConfirm: () => void
  onCancel: () => void
  selectedCount: number
  confirmDeleteName: string
  // F-004: 'reject' words the one-row dialog for an unconfirmed applicant file
  variant?: 'delete' | 'reject'
  // Caller's own t() (rule C: a shared unit never calls i18n itself) — the
  // candidate/customer/vacancy documents tabs each carry the same three keys
  // (documents.deleteTitle / deleteManyMessage / deleteOneMessage,
  // common:remove) under their own namespace.
  t: (key: string, options?: Record<string, unknown>) => string
}

/** Shared document delete confirmation dialog for the candidates, customers and
 * vacancies documents tabs. Builds the title/message/confirm-label from the
 * caller's own t() so the three call sites share one wiring (DRY round,
 * CANDTABS package — folded the former DocumentsDeleteConfirm wrapper in here
 * since this dialog has no other consumers).
 */
export default function DocumentDeleteDialog({
  open,
  onConfirm,
  onCancel,
  selectedCount,
  confirmDeleteName,
  variant = 'delete',
  t,
}: DocumentDeleteDialogProps) {
  const reject = variant === 'reject' && open?.kind === 'one'
  return (
    <ConfirmDialog
      open={!!open}
      danger
      title={reject ? t('documents.rejectTitle') : t('documents.deleteTitle')}
      message={open?.kind === 'many'
        ? t('documents.deleteManyMessage', { count: selectedCount })
        : reject ? t('documents.rejectOneMessage', { name: confirmDeleteName }) : t('documents.deleteOneMessage', { name: confirmDeleteName })}
      confirmLabel={reject ? t('documents.reject') : t('common:remove')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
