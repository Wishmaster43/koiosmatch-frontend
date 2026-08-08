/**
 * EntityDrawer — regression test for SWEEP-ESC: the shared drawer shell had no
 * Escape handler at all, so Esc closed modals but never a drawer. The fix clicks
 * the header's own close button (via the `data-drawer-close` marker EntityHeader
 * now carries) — this test drives that through the REAL EntityHeader, not a stub,
 * so a future edit to either file that breaks the wiring fails here too.
 */
import { useEffect } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import EntityDrawer from './EntityDrawer'
import EntityHeader from './EntityHeader'

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

  it('Escape swallowed by an open nested popup does not close the drawer', () => {
    const onClose = vi.fn()
    // Mimics FloatingPanel/useFocusTrap: an open popup owns a bubble-phase
    // listener on ITS OWN node and stops Escape there — the exact ordering
    // useFocusTrap.ts already relies on, reproduced without pulling the whole
    // FloatingPanel component in.
    function NestedPopup() {
      useEffect(() => {
        const node = document.getElementById('nested-popup')
        const stop = (e: KeyboardEvent) => { if (e.key === 'Escape') e.stopPropagation() }
        node?.addEventListener('keydown', stop)
        return () => node?.removeEventListener('keydown', stop)
      }, [])
      return <div id="nested-popup"><button>inside popup</button></div>
    }
    renderDrawer(onClose, () => <NestedPopup />)
    fireEvent.keyDown(screen.getByText('inside popup'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
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
