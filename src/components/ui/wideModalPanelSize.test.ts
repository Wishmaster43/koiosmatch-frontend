import { describe, it, expect } from 'vitest'
import { WIDE_MODAL_PANEL_SIZE } from './wideModalPanelSize'
import { WIDE_MODAL } from './modalMetrics'

describe('WIDE_MODAL_PANEL_SIZE', () => {
  // Clone: AddCustomerModal + AddOrderModal both built this exact pair inline.
  it('derives width/maxWidth from WIDE_MODAL.maxWidth', () => {
    expect(WIDE_MODAL_PANEL_SIZE).toEqual({
      width: `min(calc(100vw - 48px), ${WIDE_MODAL.maxWidth}px)`,
      maxWidth: `${WIDE_MODAL.maxWidth}px`,
    })
  })
})
