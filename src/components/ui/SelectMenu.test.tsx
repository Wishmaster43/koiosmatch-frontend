import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SelectMenu from './SelectMenu'

// Audit finding (§6, WCAG 2.2 AA): SelectMenu had zero Escape handling and never
// returned focus to the trigger on close — a keyboard user could only close it
// by clicking elsewhere, and then lost their place entirely. Covers Escape,
// focus restoration on pick/Escape, and that a CLOSED menu never swallows an
// Escape meant for an ancestor (e.g. a wrapping modal's own close-on-Escape).
describe('SelectMenu · keyboard + focus (§6 WCAG 2.2 AA)', () => {
  it('Escape closes the open menu', async () => {
    const user = userEvent.setup()
    render(<SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />)
    await user.click(screen.getByRole('button', { name: 'Pick' }))
    expect(screen.getByRole('button', { name: 'b' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'b' })).not.toBeInTheDocument()
  })

  it('never attaches an Escape listener while closed, so an ancestor still receives the key', async () => {
    const user = userEvent.setup()
    const ancestorSpy = vi.fn()
    document.addEventListener('keydown', ancestorSpy)
    render(<SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />)
    // Menu is never opened — Escape must reach the document listener untouched.
    await user.keyboard('{Escape}')
    expect(ancestorSpy).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', ancestorSpy)
  })

  it('restores focus to the trigger after picking an option', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SelectMenu value={null} onChange={onChange} options={['a', 'b']} placeholder="Pick" />)
    const trigger = screen.getByRole('button', { name: 'Pick' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'b' }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(trigger).toHaveFocus()
  })

  it('restores focus to the trigger after Escape', async () => {
    const user = userEvent.setup()
    render(<SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />)
    const trigger = screen.getByRole('button', { name: 'Pick' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('does not steal focus from another element when closed by an outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <SelectMenu value={null} onChange={() => {}} options={['a', 'b']} placeholder="Pick" />
        <button>elsewhere</button>
      </div>,
    )
    const trigger = screen.getByRole('button', { name: 'Pick' })
    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'b' })).toBeInTheDocument()
    const elsewhere = screen.getByRole('button', { name: 'elsewhere' })
    await user.click(elsewhere)
    expect(elsewhere).toHaveFocus()
    expect(trigger).not.toHaveFocus()
  })
})
