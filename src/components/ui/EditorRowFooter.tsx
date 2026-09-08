/**
 * EditorRowFooter — action row for expanded edit cards (MatchTemplatesSettings,
 * VacancyContentBlocksSettings, CustomFieldsSettings, VacancyGenerationProfilesList).
 * Left: the delete button (dangerSoft, icon + label, disabled while in use or saving);
 * right: cancel + save (secondary + primary, the save label reflects `saving`).
 * DRY-1 O5: this exact row was copied in the four screens above.
 */
import { Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'

export interface EditorRowFooterProps {
  onDelete: () => void
  deleteLabel: string
  deleteDisabled?: boolean
  deleteTitle?: string
  onCancel: () => void
  cancelLabel: string
  onSave: () => void
  saveLabel: string
  savingLabel: string
  saving: boolean
  saveDisabled?: boolean
}

export default function EditorRowFooter({
  onDelete,
  deleteLabel,
  deleteDisabled = false,
  deleteTitle,
  onCancel,
  cancelLabel,
  onSave,
  saveLabel,
  savingLabel,
  saving,
  saveDisabled = false,
}: EditorRowFooterProps) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
      <Button
        variant="dangerSoft"
        size="sm"
        onClick={onDelete}
        disabled={deleteDisabled || saving}
        title={deleteTitle}
      >
        <Trash2 size={12} /> {deleteLabel}
      </Button>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          disabled={saving || saveDisabled}
        >
          {saving ? savingLabel : saveLabel}
        </Button>
      </div>
    </div>
  )
}
