/**
 * FloatingPanel — the shared draggable/resizable dialog shell has no dedicated
 * test file yet; this covers the base open/close contract plus the NEW
 * NOTITIE-POPOUT-1 F5 `onPopOut` header button: renders only when the prop is
 * supplied, and clicking it fires the callback (never opens `onClose` too).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  // DD-FE-7 ("Esc closes every popup"): FloatingPanel is the ONE shared shell every
  // modal migrates onto — its Escape-to-close comes from the shared useFocusTrap
  // hook (mounted on the dialog node), so this proves the wiring stays intact.
  it('closes on Escape via the shared focus trap', () => {
    const onClose = vi.fn()
    render(<FloatingPanel open onClose={onClose} title="Test panel">panel body</FloatingPanel>)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// POPUP-SLEEP (Danny punt 19): the shell is what actually WEARS the drag engine, so
// prove it end-to-end on the rendered DOM — a header drag moves the real panel, the
// body never drags (text selection must keep working), and a modeless panel lets the
// screen behind it stay visible/clickable.
describe('FloatingPanel · draggable by its header', () => {
  // jsdom returns an all-zero rect; give the panel a realistic geometry so the
  // grab-offset and the viewport clamp mean something.
  function stubRect(el: HTMLElement) {
    el.getBoundingClientRect = () => ({
      x: 100, y: 50, left: 100, top: 50, width: 900, height: 600,
      right: 1000, bottom: 650, toJSON: () => ({}),
    }) as DOMRect
  }
  // jsdom has no PointerEvent constructor; React listens on the 'pointerdown' TYPE,
  // so a bubbling MouseEvent with that name drives the same handler.
  const pointer = (type: string, clientX: number, clientY: number) =>
    new MouseEvent(type, { bubbles: true, clientX, clientY })

  it('moves the panel to the dragged position and keeps it inside the viewport', () => {
    render(<FloatingPanel open onClose={vi.fn()} title="Drag me">panel body</FloatingPanel>)
    const dialog = screen.getByRole('dialog') as HTMLElement
    const handle = dialog.querySelector('[data-drag-handle]') as HTMLElement
    stubRect(dialog)
    // Pre-drag the panel is CSS-centered — no explicit coordinates at all.
    expect(dialog.style.position).toBe('relative')

    fireEvent(handle, pointer('pointerdown', 150, 70))
    fireEvent(window, pointer('pointermove', 300, 200))
    expect(dialog.style.position).toBe('fixed')
    expect(dialog.style.left).toBe('250px')
    expect(dialog.style.top).toBe('180px')

    // Dragged far off-screen it stops at the edge instead of disappearing.
    fireEvent(window, pointer('pointermove', 9999, 9999))
    expect(dialog.style.left).toBe(`${window.innerWidth - 80}px`)
    expect(dialog.style.top).toBe(`${window.innerHeight - 48}px`)
    fireEvent(window, pointer('pointerup', 9999, 9999))
  })

  it('does not drag from the body — only the header moves the window', () => {
    render(<FloatingPanel open onClose={vi.fn()} title="Drag me">panel body</FloatingPanel>)
    const dialog = screen.getByRole('dialog') as HTMLElement
    stubRect(dialog)

    fireEvent(screen.getByText('panel body'), pointer('pointerdown', 150, 70))
    fireEvent(window, pointer('pointermove', 300, 200))
    expect(dialog.style.position).toBe('relative')
    expect(dialog.style.left).toBe('')
  })

  it('renders modeless (no scrim, clicks fall through) when overlay is false', () => {
    const onClose = vi.fn()
    render(<FloatingPanel open onClose={onClose} overlay={false} title="Reference">body</FloatingPanel>)
    const dialog = screen.getByRole('dialog')
    const scrim = dialog.parentElement as HTMLElement

    expect(scrim.style.background).toBe('none')
    expect(scrim.style.pointerEvents).toBe('none')
    expect(dialog).not.toHaveAttribute('aria-modal')
    // A backdrop click cannot close a modeless window — the caller owns that rule.
    fireEvent.mouseDown(scrim)
    expect(onClose).not.toHaveBeenCalled()
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

// ASSIST-SIDEPANEEL-1 (Danny's punt 1): the maximize/restore toggle.
describe('FloatingPanel · maximizable', () => {
  it('renders no maximize button when the prop is omitted', () => {
    render(<FloatingPanel open onClose={vi.fn()} title="Test">body</FloatingPanel>)
    expect(screen.queryByLabelText('maximizeWindow')).toBeNull()
  })

  it('toggles between maximizeWindow and restoreWindow aria-labels on click', async () => {
    const user = userEvent.setup()
    render(<FloatingPanel open onClose={vi.fn()} title="Test" maximizable>body</FloatingPanel>)
    const maxBtn = screen.getByLabelText('maximizeWindow')
    await user.click(maxBtn)
    expect(screen.getByLabelText('restoreWindow')).toBeInTheDocument()
    expect(screen.queryByLabelText('maximizeWindow')).toBeNull()
  })
})
