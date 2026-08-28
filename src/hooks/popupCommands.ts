/**
 * popupCommands — THE one shortcut-key file for popups (walkthrough 21-08,
 * POP-UPS 3.2, verbatim: "een apart TSX voor sneltoetsen" — i.e. "a separate
 * TSX for shortcut keys"). Every key that a popup understands app-wide lives
 * HERE — nowhere else. Consumers:
 *   - useFocusTrap (every FloatingPanel modal + the standalone trapped panels)
 *     routes its keydown through this for Tab-trap; Escape itself now goes
 *     through the layered stack (useEscapeLayer, TRIAGE-3.3) instead.
 * A NEW popup shortcut (e.g. Cmd+Enter = primary action) lands as one case in
 * handlePopupKeydown + one line in POPUP_COMMANDS, and then works everywhere.
 */

// Human-readable command table — the one source for a future shortcuts
// overview in the UI (labels go through i18n at the place that shows it).
export const POPUP_COMMANDS = [
  { keys: 'Escape', command: 'close (top layer first — useEscapeLayer stack)' },
  { keys: 'Tab / Shift+Tab', command: 'cycle-focus (within the popup)' },
] as const

export interface PopupKeyHandlers {
  // Focus cycle (Tab): only set by useFocusTrap, which knows the focusables.
  focusables?: () => HTMLElement[]
}

/**
 * Handle one keydown against the popup command table. Returns true when the
 * key was a command (handled), false when it should keep propagating freely.
 */
export function handlePopupKeydown(e: KeyboardEvent, { focusables }: PopupKeyHandlers): boolean {
  // Escape goes through the layered stack (useEscapeLayer, TRIAGE-3.3): the
  // trap and every overlay register as layers, and only the TOP layer closes —
  // this table only handles Tab-trap.
  if (e.key === 'Tab' && focusables) {
    const items = focusables()
    if (items.length === 0) { e.preventDefault(); return true }
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); return true }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); return true }
    return true
  }
  return false
}
