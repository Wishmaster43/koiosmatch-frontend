/**
 * fields.keydown — TextField's `onKeyDown` passthrough regression (found on
 * OutreachCreate: Enter-to-submit silently vanished because TextField destructured
 * a fixed prop set and never forwarded onKeyDown to the underlying <input>).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextField } from './fields'

describe('TextField · onKeyDown passthrough', () => {
  it('forwards onKeyDown to the underlying input', async () => {
    const onKeyDown = vi.fn()
    const user = userEvent.setup()
    render(<TextField value="" onChange={() => {}} placeholder="Naam" onKeyDown={onKeyDown} />)
    await user.type(screen.getByRole('textbox'), '{Enter}')
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    expect(onKeyDown.mock.calls[0][0]).toMatchObject({ key: 'Enter' })
  })

  it('renders fine without onKeyDown (optional prop, no crash)', () => {
    render(<TextField value="" onChange={() => {}} placeholder="Naam" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
