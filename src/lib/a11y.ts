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
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
    },
  }
}
