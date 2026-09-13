// Unit test for the shared drawer panel shell (DRY round 11 P2): asserts the
// dialog a11y contract and that a backdrop click calls onClose.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DrawerPanelShell from './DrawerPanelShell'
import { createRef } from 'react'

describe('DrawerPanelShell', () => {
  it('renders a labelled dialog with children, and a backdrop that closes it', () => {
    const onClose = vi.fn()
    const ref = createRef<HTMLDivElement>()
    render(
      <DrawerPanelShell panelRef={ref} ariaLabel="Test panel" onClose={onClose}
        className="fixed" style={{ width: 400 }}>
        <span>panel body</span>
      </DrawerPanelShell>
    )
    const dialog = screen.getByRole('dialog', { name: 'Test panel' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('panel body')).toBeInTheDocument()

    // The backdrop renders alongside the panel — clicking it closes the drawer.
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })
})
