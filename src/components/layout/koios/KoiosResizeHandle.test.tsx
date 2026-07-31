import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosResizeHandle from './KoiosResizeHandle'

// t() just echoes the key here (no i18n init in this test) — good enough to
// assert the accessible name is wired, not to check the translated copy.
const t = ((key: string) => key) as unknown as (key: string) => string

describe('KoiosResizeHandle', () => {
  // WCAG 2.2 AA (§6): a drag handle needs a real role, accessible name and
  // value range — a `title`-only div would fail a screen-reader user.
  it('exposes separator semantics with an accessible name and current value', () => {
    render(<KoiosResizeHandle width={400} minWidth={260} maxWidth={720} onPointerDown={() => {}} onKeyDown={() => {}} t={t} />)
    const handle = screen.getByRole('separator', { name: 'koios.resizeHandle' })
    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    expect(handle).toHaveAttribute('aria-valuenow', '400')
    expect(handle).toHaveAttribute('aria-valuemin', '260')
    expect(handle).toHaveAttribute('aria-valuemax', '720')
  })

  // WCAG 2.2 AA (§6): the handle must be reachable by Tab and must forward a
  // real keyboard event — a mouse-only handle (plain onPointerDown, no
  // onKeyDown/tabIndex) fails this exact check.
  it('is focusable and forwards a real keyboard event to onKeyDown', async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    render(<KoiosResizeHandle width={400} minWidth={260} maxWidth={720} onPointerDown={() => {}} onKeyDown={onKeyDown} t={t} />)
    const handle = screen.getByRole('separator')
    expect(handle).toHaveAttribute('tabindex', '0')
    await user.tab()
    expect(handle).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'ArrowRight' }))
  })
})
