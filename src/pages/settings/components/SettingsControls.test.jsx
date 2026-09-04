/**
 * SettingsControls ColorSwatch — outside-click-closes-popup regression for the
 * CLICK-OUTSIDE-2 adoption of the shared useClickOutside hook.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorSwatch } from './SettingsControls'

describe('ColorSwatch popup', () => {
  it('opens the palette popup on trigger click and closes it on an outside mousedown', async () => {
    const user = userEvent.setup()
    render(<ColorSwatch color="var(--color-primary)" onChange={vi.fn()} />)

    // Only the swatch trigger renders before the popup opens.
    expect(screen.getAllByRole('button')).toHaveLength(1)

    await user.click(screen.getAllByRole('button')[0])
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1)

    act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
