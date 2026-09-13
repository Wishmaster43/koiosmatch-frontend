// TextExpandControl — the "enlarge this field" affordance shared by every text
// control that can open TextExpandModal: an icon-only Button plus the modal,
// wired to the same value/onChange so closing never loses an edit.
import { Maximize2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { TextExpandModal } from './TextExpandModal'

export function TextExpandControl({ label, expandLabel, value, onChange, expanded, onExpand, onClose, style }: {
  label: string
  // Separate button label/tooltip (e.g. t('fields.textExpand')) vs the field label
  // shown in the modal title.
  expandLabel: string
  value: string
  onChange: (next: string) => void
  expanded: boolean
  onExpand: () => void
  onClose: () => void
  // Absolute position of the trigger button — callers place it over their own textarea.
  style: React.CSSProperties
}) {
  return (
    <>
      <Button iconOnly variant="ghost" size="sm" onClick={onExpand}
        aria-label={expandLabel} title={expandLabel} style={style}>
        <Maximize2 size={12} />
      </Button>
      {expanded && (
        <TextExpandModal label={label} value={value} onChange={onChange} onClose={onClose} />
      )}
    </>
  )
}
