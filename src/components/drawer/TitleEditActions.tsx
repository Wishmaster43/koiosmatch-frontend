/**
 * TitleEditActions — shared save/cancel icon-button pair for a drawer's inline
 * title edit (pairs with TitleEditInput). Labels come from the consumer's own
 * t() (§5); this only carries the identical Button markup (DRY round 10, DRAWERSHELLS).
 */
import { Save, X } from 'lucide-react'
import Button from '@/components/ui/Button'

interface TitleEditActionsProps {
  onSave: () => void
  onCancel: () => void
  saveLabel: string
  cancelLabel: string
}

// Save/cancel icon-button pair shown while a drawer title is being edited inline.
export default function TitleEditActions({ onSave, onCancel, saveLabel, cancelLabel }: TitleEditActionsProps) {
  return (
    <>
      <Button variant="primary" iconOnly size="sm" onClick={onSave} title={saveLabel} aria-label={saveLabel}><Save size={14} /></Button>
      <Button variant="secondary" iconOnly size="sm" onClick={onCancel} title={cancelLabel} aria-label={cancelLabel}><X size={14} /></Button>
    </>
  )
}
