/**
 * popupCommands — HET ene sneltoetsen-bestand voor pop-ups (walkthrough 21-08,
 * POP-UPS 3.2: "een apart TSX voor sneltoetsen"). Elke toets die een popup
 * app-breed verstaat, staat HIER — nergens anders. Consumers:
 *   - useFocusTrap (elke FloatingPanel-modal + de losse getrapte panels) routes
 *     zijn keydown hierdoorheen — Esc-sluiten + Tab-trap.
 *   - WorkflowCanvasEditor's document-level Esc (de bewaakte editor-exit).
 * Een NIEUWE popup-sneltoets (bijv. Cmd+Enter = primaire actie) landt als één
 * case in handlePopupKeydown + één regel in POPUP_COMMANDS, en werkt dan overal.
 */

// Menselijk leesbare commandotabel — de ene bron voor een toekomstig
// sneltoetsen-overzicht in de UI (labels via i18n op de plek die hem toont).
export const POPUP_COMMANDS = [
  { keys: 'Escape', command: 'close' },
  { keys: 'Tab / Shift+Tab', command: 'cycle-focus (binnen de popup)' },
] as const

export interface PopupKeyHandlers {
  // Sluiten (Esc). De aanroeper bepaalt wat "sluiten" betekent — een bewaakte
  // editor-exit geeft hier zijn eigen confirm-variant door.
  onClose?: () => void
  // Focus-cyclus (Tab): alleen gezet door useFocusTrap, dat de focusables kent.
  focusables?: () => HTMLElement[]
}

/**
 * Verwerk één keydown volgens de popup-commandotabel. Retourneert true als de
 * toets een commando was (afgehandeld), false als hij vrij doorloopt.
 */
export function handlePopupKeydown(e: KeyboardEvent, { onClose, focusables }: PopupKeyHandlers): boolean {
  if (e.key === 'Escape') {
    // stopPropagation: een geneste popup sluit alléén zichzelf, nooit zijn host.
    e.stopPropagation()
    onClose?.()
    return true
  }
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
