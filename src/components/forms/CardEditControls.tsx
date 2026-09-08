import { Save, Edit2, X } from 'lucide-react'
import Button from '@/components/ui/Button'

// Reusable edit/save/cancel button trio rendered in GroupHeader with flex gap-4.
// Consumed by BankAccountCard, EmergencyContactCard, ZzpAddressCard.
// Strings (title, aria-label) are passed by the consumer so i18n stays there.
export function CardEditControls({
  editing,
  onStart,
  onSave,
  onCancel,
  saveLabel,
  cancelLabel,
  editLabel,
}: {
  editing: boolean
  onStart: () => void
  onSave: () => void
  onCancel: () => void
  saveLabel: string
  cancelLabel: string
  editLabel: string
}) {
  return editing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      <Button
        variant="primary"
        size="sm"
        iconOnly
        onClick={onSave}
        title={saveLabel}
        aria-label={saveLabel}
      >
        <Save size={13} />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        iconOnly
        onClick={onCancel}
        title={cancelLabel}
        aria-label={cancelLabel}
      >
        <X size={13} />
      </Button>
    </div>
  ) : (
    <Button
      variant="secondary"
      size="sm"
      iconOnly
      onClick={onStart}
      title={editLabel}
      aria-label={editLabel}
    >
      <Edit2 size={13} />
    </Button>
  )
}
