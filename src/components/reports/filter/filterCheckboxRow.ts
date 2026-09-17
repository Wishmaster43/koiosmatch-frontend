/**
 * filterCheckboxRow — the literal bits a checkbox-option row repeated
 * byte-for-byte across this folder's three filter groups (D1 DRY audit
 * finding): the checkbox input's own style, and the hover-tint pair an
 * open/searchable option row uses while unchecked. Extracted so a future
 * accent/size tweak lands once, not in three near-identical copies.
 */
import type { MouseEvent } from 'react'

// The checkbox input's own style — identical in FilterGroupBlock's plain-list
// branch, OpenCheckGroup and SearchSelectGroup (12x12, primary accent colour).
export const FILTER_CHECKBOX_INPUT_STYLE = {
  accentColor: 'var(--color-primary)', width: 12, height: 12, flexShrink: 0,
} as const

// The hover-highlight pair an option row uses while unchecked (tints on enter,
// clears on leave) — identical in OpenCheckGroup and SearchSelectGroup.
export function checkboxRowHoverHandlers(checked: boolean) {
  return {
    onMouseEnter: (e: MouseEvent<HTMLLabelElement>) => { if (!checked) e.currentTarget.style.background = 'var(--hover-bg)' },
    onMouseLeave: (e: MouseEvent<HTMLLabelElement>) => { if (!checked) e.currentTarget.style.background = 'transparent' },
  }
}
