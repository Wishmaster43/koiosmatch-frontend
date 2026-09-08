/**
 * AddFormFooter — action row for add-form cards (MatchTemplatesSettings,
 * VacancyContentBlocksSettings, CustomFieldsSettings, VacancyGenerationProfilesList).
 * Right-aligned: cancel + submit buttons (secondary + primary); the primary label
 * reflects the saving state.
 */
import Button from '@/components/ui/Button'

export interface AddFormFooterProps {
  onCancel: () => void
  cancelLabel: string
  onSubmit: () => void
  submitLabel: string
  savingLabel: string
  saving: boolean
  disabled?: boolean
}

export default function AddFormFooter({
  onCancel,
  cancelLabel,
  onSubmit,
  submitLabel,
  savingLabel,
  saving,
  disabled = false,
}: AddFormFooterProps) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <Button variant="secondary" size="sm" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={onSubmit}
        disabled={saving || disabled}
      >
        {saving ? savingLabel : submitLabel}
      </Button>
    </div>
  )
}
