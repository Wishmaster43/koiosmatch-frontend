/**
 * a11y — small keyboard-interaction helpers (§6, WCAG 2.2 AA) spread onto elements
 * that need button-like or row-like keyboard behaviour without changing their
 * semantic role. See the per-export doc comments below.
 */
import type { KeyboardEvent } from 'react'

// Shared Enter/Space activation guard for interactive()/interactiveRow(): acts
// only on keys pressed ON the element itself, never bubbled up from a
// focusable CHILD (a real button inside an interactive row) — see interactive()'s
// doc comment for the bug this guard fixes.
function onSelfKeyDown(onClick: () => void) {
  return (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
  }
}

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
    onKeyDown: onSelfKeyDown(onClick),
  }
}

/**
 * interactiveRow — keyboard path for a clickable TABLE ROW (heraudit r3 HIGH:
 * DataTable rows opened by mouse only). Same Enter/Space + self-target guard as
 * interactive(), but WITHOUT role="button": a <tr> must keep its native row
 * semantics or screen readers stop announcing it as a table row. Focus comes
 * from tabIndex; the browser's focus outline marks the row (§6).
 */
export function interactiveRow(onClick?: () => void) {
  if (!onClick) return {}
  return {
    tabIndex: 0,
    onClick,
    onKeyDown: onSelfKeyDown(onClick),
  }
}
