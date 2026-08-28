/**
 * EntityDrawer — regression test for SWEEP-ESC: the shared drawer shell had no
 * Escape handler at all, so Esc closed modals but never a drawer. The fix clicks
 * the header's own close button (via the `data-drawer-close` marker EntityHeader
 * now carries) — this test drives that through the REAL EntityHeader, not a stub,
 * so a future edit to either file that breaks the wiring fails here too.
 */
import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import EntityDrawer from './EntityDrawer'
import EntityHeader from './EntityHeader'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'
import { useFocusTrap } from '@/hooks/useFocusTrap'

// Minimal single-tab host — mirrors how every real entity drawer wires onClose
// into EntityHeader from its own header render function.
function renderDrawer(onClose: () => void, tabRender: () => React.ReactNode = () => <div>content</div>) {
  return render(
    <EntityDrawer
      entity={{ id: 1 }}
      header={() => <EntityHeader label="Test" title="Entity" onClose={onClose} />}
      tabs={[{ id: 't1', label: 'Tab 1', render: tabRender }]}
    />
  )
}

describe('EntityDrawer · Escape-to-close (SWEEP-ESC)', () => {
  it('Escape triggers the header close button (onClose)', () => {
    const onClose = vi.fn()
    renderDrawer(onClose)
    fireEvent.keyDown(screen.getByText('content'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('other keys do not trigger close', () => {
    const onClose = vi.fn()
    renderDrawer(onClose)
    fireEvent.keyDown(screen.getByText('content'), { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Escape closes only the top layer: a nested popup opened AFTER the drawer wins over the drawer', () => {
    // TRIAGE-3.3: EntityDrawer's own Escape-to-close is now itself a useEscapeLayer
    // registration (a window-capture stack), superseding the old bubble-phase trick
    // this test used to simulate (a popup's own node-level stopPropagation no longer
    // matters — capture fires before any bubble listener sees the key). The correct
    // way for a nested overlay to win is to register as ITS OWN top layer, exactly
    // like useFocusTrap/SelectMenu are expected to once they adopt the same hook.
    // The popup opens on a click AFTER the drawer has mounted (the real-world
    // sequence) so its layer is pushed on top of the drawer's, not simultaneously
    // at initial mount where child-before-parent effect order would invert it.
    const onClose = vi.fn()
    const onPopupClose = vi.fn()
    function NestedPopup() {
      const [open, setOpen] = useState(false)
      useEscapeLayer(open, onPopupClose)
      if (!open) return <button onClick={() => setOpen(true)}>open popup</button>
      return <div id="nested-popup"><button>inside popup</button></div>
    }
    renderDrawer(onClose, () => <NestedPopup />)
    fireEvent.click(screen.getByText('open popup'))
    fireEvent.keyDown(screen.getByText('inside popup'), { key: 'Escape' })
    expect(onPopupClose).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Escape in a REAL focus-trapped popup closes the popup, never the drawer (regression 28-08)', () => {
    // The verify round measured exactly this going wrong mid-wave: the drawer's
    // window-capture layer swallowed Escape from a useFocusTrap panel (the
    // FloatingPanel/ConfirmDialog/ChangelogPopover family). Since the trap now
    // registers its own layer on arm, the popup must win — pinned here against
    // the REAL hook, not a stand-in.
    const onClose = vi.fn()
    const onPopupClose = vi.fn()
    function TrappedPopup() {
      const [open, setOpen] = useState(false)
      // Real close: unmounts the panel so the trap disarms and pops its layer.
      const trapRef = useFocusTrap<HTMLDivElement>(() => { onPopupClose(); setOpen(false) })
      if (!open) return <button onClick={() => setOpen(true)}>open trapped</button>
      return <div ref={trapRef} role="dialog" aria-modal="true" aria-label="trapped" tabIndex={-1}><button>in trap</button></div>
    }
    renderDrawer(onClose, () => <TrappedPopup />)
    fireEvent.click(screen.getByText('open trapped'))
    fireEvent.keyDown(screen.getByText('in trap'), { key: 'Escape' })
    expect(onPopupClose).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    // Second Escape, popup gone: NOW the drawer closes — the layered order.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does nothing on Escape when no header close button is rendered (defensive)', () => {
    // A bespoke header ReactNode with no EntityHeader/close button at all — the
    // shell must not throw when the marker is simply absent.
    render(
      <EntityDrawer entity={{ id: 1 }} header={<div>bespoke header</div>}
        tabs={[{ id: 't1', label: 'Tab 1', render: () => <div>content</div> }]} />
    )
    expect(() => fireEvent.keyDown(screen.getByText('content'), { key: 'Escape' })).not.toThrow()
  })
})
