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

  // SETTINGS-INCON-B2 F1 (Opus review, 13-09): the popup used to render
  // `position: absolute` inside its trigger's own subtree — clipped by a hosting
  // modal's `overflow: hidden`/`auto` panel. It now portals into document.body,
  // so a palette swatch lives OUTSIDE the render container regardless of what
  // overflow ancestor wraps the trigger.
  it('portals the palette popup into document.body, not inside the trigger\'s own subtree', async () => {
    const user = userEvent.setup()
    const { container } = render(<ColorSwatch color="var(--color-primary)" onChange={vi.fn()} />)

    await user.click(screen.getAllByRole('button')[0])
    const buttons = screen.getAllByRole('button')
    const swatchButton = buttons[buttons.length - 1]
    expect(container.contains(swatchButton)).toBe(false)
    expect(document.body.contains(swatchButton)).toBe(true)
  })
})
