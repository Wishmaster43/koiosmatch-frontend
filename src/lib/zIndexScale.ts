/**
 * zIndexScale — the ONE stacking order for overlays (POPUP-SLEEP-1). Before this,
 * every modal hand-copied magic numbers (200/300/9999); a window manager needs a
 * single scale or dragged windows stack unpredictably. Keep additions HERE.
 */
export const Z = {
  /** Dropdowns/popovers inside the page flow. */
  popover: 70,
  /** Regular modal overlays (the historical 200 layer). */
  modal: 200,
  /** Confirm/blocking dialogs — always above any open modal (historical 300). */
  confirm: 300,
  /** Toasts/notifications — above everything interactive. */
  toast: 400,
} as const

// Bring-to-front counter for floating panels: every focus/pointerdown claims the
// next slot INSIDE the modal band, so the last-touched window wins without ever
// climbing above the confirm layer.
let floatingTop: number = Z.modal
export function nextFloatingZ(): number {
  floatingTop = floatingTop >= Z.confirm - 2 ? Z.modal : floatingTop + 1
  return floatingTop
}
