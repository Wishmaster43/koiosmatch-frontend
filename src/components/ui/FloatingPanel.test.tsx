/**
 * FloatingPanel — the shared draggable/resizable dialog shell has no dedicated
 * test file yet; this covers the base open/close contract plus the NEW
 * NOTITIE-POPOUT-1 F5 `onPopOut` header button: renders only when the prop is
 * supplied, and clicking it fires the callback (never opens `onClose` too).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingPanel from './FloatingPanel'

describe('FloatingPanel · base contract', () => {
  it('renders nothing while closed', () => {
    render(<FloatingPanel open={false} onClose={vi.fn()} title="Test">body</FloatingPanel>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the dialog with its title and children while open', () => {
    render(<FloatingPanel open onClose={vi.fn()} title="Test panel">panel body</FloatingPanel>)
    expect(screen.getByRole('dialog', { name: 'Test panel' })).toBeInTheDocument()
    expect(screen.getByText('panel body')).toBeInTheDocument()
  })
})

describe('FloatingPanel · onPopOut (NOTITIE-POPOUT-1 F5)', () => {
  it('renders no pop-out button when the prop is omitted', () => {
    render(<FloatingPanel open onClose={vi.fn()} title="Test">body</FloatingPanel>)
    expect(screen.queryByLabelText('openSecondScreen')).toBeNull()
  })

  it('renders the pop-out button and fires the callback on click, without closing the panel', async () => {
    const user = userEvent.setup()
    const onPopOut = vi.fn()
    const onClose = vi.fn()
    render(<FloatingPanel open onClose={onClose} onPopOut={onPopOut} title="Test">body</FloatingPanel>)
    const button = screen.getByLabelText('openSecondScreen')
    await user.click(button)
    expect(onPopOut).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })
})
