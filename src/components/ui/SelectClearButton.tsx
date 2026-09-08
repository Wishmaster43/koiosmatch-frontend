/**
 * SelectClearButton — the ONE "unset this value" affordance every shared picker
 * renders (DROPDOWN-CLEAR-1, Danny 08-09: "niet in elke zoekbare dropdown is een
 * clear"). A SIBLING of the trigger, never a child: a <button> inside a <button>
 * is invalid HTML and browsers drop the inner one from the tab order. It is the
 * house ghost icon Button, absolutely positioned over the slot the trigger's value
 * span reserves (CLEAR_BUTTON_SIZE), so it is a real focusable control with a text
 * accessible name (§6). Owned here so CreatableSelect, SelectMenu and SearchSelect
 * cannot drift apart again.
 */
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Button from './Button'

// The slot the trigger's value span reserves (marginRight) while the X shows — the
// ghost sm Button's own footprint — and the X's distance from the trigger's right
// edge (clear of the chevron).
export const CLEAR_BUTTON_SIZE = 28
export const CLEAR_BUTTON_RIGHT = 22

interface SelectClearButtonProps {
  // The trigger's id; the button takes `${id}-clear` so tests and labels can reference it.
  triggerId: string
  // Field name woven into the accessible name ("Klantlocatie wissen"); omitted = "Wissen".
  clearLabel?: string
  // Kept for API compatibility with the pickers' label wiring; the name is complete on its own.
  'aria-labelledby'?: string
  onClear: () => void
}

export default function SelectClearButton({ triggerId, clearLabel, onClear }: SelectClearButtonProps) {
  const { t } = useTranslation('common')
  const clearName = clearLabel ? t('clearField', { field: clearLabel }) : t('clear')
  return (
    <Button variant="ghost" size="sm" iconOnly aria-label={clearName} title={clearName} id={`${triggerId}-clear`}
      onClick={onClear}
      style={{ position: 'absolute', right: CLEAR_BUTTON_RIGHT, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
      <X size={12} aria-hidden="true" />
    </Button>
  )
}
