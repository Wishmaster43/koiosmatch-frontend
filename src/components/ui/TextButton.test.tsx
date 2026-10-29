import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TextButton from './TextButton'

describe('TextButton', () => {
  it('fires onClick on click', () => {
    const fn = vi.fn()
    render(<TextButton onClick={fn}>Go</TextButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('activates with Enter and Space on the real button', async () => {
    const fn = vi.fn()
    const user = userEvent.setup()
    render(<TextButton onClick={fn}>Go</TextButton>)
    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('wraps: no nowrap and no fixed height', () => {
    render(<TextButton>Long text</TextButton>)
    const st = screen.getByRole('button').style
    expect(st.whiteSpace).toBe('normal')
    expect(st.height).toBe('')
  })

  it('does not fire when disabled', () => {
    const fn = vi.fn()
    render(<TextButton disabled onClick={fn}>Go</TextButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).not.toHaveBeenCalled()
  })
})
