import type { KeyboardEvent } from 'react'

/**
 * interactive — make a non-button element keyboard-operable (§6, WCAG 2.2 AA).
 * Spread onto a clickable <div>/<span> that can't be a real <button>; it adds
 * button semantics, focusability and Enter/Space activation. Returns nothing
 * when there is no handler, so non-clickable elements stay inert.
 */
export function interactive(onClick?: () => void) {
  if (!onClick) return {}
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick,
    onKeyDown: (e: KeyboardEvent) => {
      // Only act on keys pressed ON the element itself. A focusable CHILD (a real
      // button inside an interactive row) handles its own Enter/Space; before this
      // guard the row swallowed the child's activation with preventDefault AND
      // fired its own — Enter on a workflow-row toggle opened the editor and
      // cancelled the switch (Opus review, batch C finding 3; click paths were
      // guarded per call-site, the keyboard path never was).
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
    },
  }
}
