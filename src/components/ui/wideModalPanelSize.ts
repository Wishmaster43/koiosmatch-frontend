import { WIDE_MODAL } from './modalMetrics'

/**
 * WIDE_MODAL_PANEL_SIZE — the shared FloatingPanel width/maxWidth pair every
 * "wide form" modal spreads onto its panel (clone: AddCustomerModal +
 * AddOrderModal). Derived from the existing WIDE_MODAL.maxWidth constant, so a
 * future resize still only ever touches modalMetrics.ts.
 */
export const WIDE_MODAL_PANEL_SIZE = {
  width: `min(calc(100vw - 48px), ${WIDE_MODAL.maxWidth}px)`,
  maxWidth: `${WIDE_MODAL.maxWidth}px`,
} as const
