/**
 * zIndexScale — the NUMERIC mirror of the CSS z-ladder in index.css
 * ("HUISSTIJL-1 scales"). FloatingPanel's bring-to-front counter computes with
 * these (a CSS var string can't be incremented — RunDetailDrawer does zIndex+1),
 * so numbers must exist; but the VALUES are the ladder's, one to one. Change
 * them TOGETHER with index.css or stacking silently inverts (Opus E2).
 * Note: dropdown PORTALS do not use Z.popover — they sit on var(--z-popover)
 * (300) at body level so they beat every dialog in the band below.
 */
export const Z = {
  /** In-flow popovers under a dialog band (rare; portalled dropdowns use the CSS rung). */
  popover: 70,
  /** Dialog band floor — mirrors --z-overlay (200); panels claim 201-298. */
  modal: 200,
  /** Confirm-on-top-of-modal — mirrors --z-confirm (350). */
  confirm: 350,
  /** Toasts — mirrors --z-toast (400). */
  toast: 400,
} as const

// Bring-to-front counter for floating panels: every focus/pointerdown claims the
// next slot INSIDE the modal band, so the last-touched window wins without ever
// climbing above the confirm layer.
let floatingTop: number = Z.modal
export function nextFloatingZ(): number {
  // The band stays 201-298: below var(--z-popover) (300), so a dropdown opened
  // FROM a floating panel always paints above every panel.
  floatingTop = floatingTop >= 298 ? Z.modal : floatingTop + 1
  return floatingTop
}
