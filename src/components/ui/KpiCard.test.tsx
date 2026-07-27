import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Users } from 'lucide-react'
import KpiCard from './KpiCard'
import KpiBlock from './KpiBlock'

// Click-to-filter KPI tiles (§3A blueprint) must be keyboard-operable: a clickable
// card is a real button-role element (focusable, Enter/Space fires the handler);
// a non-clickable card stays out of the tab order entirely (no role, no tabIndex).
describe('KpiCard', () => {
  it('is not focusable and carries no button role when there is no onClick', () => {
    const { container } = render(<KpiCard label="Total" value={12} />)
    const card = container.firstElementChild
    expect(card).not.toHaveAttribute('role')
    expect(card).not.toHaveAttribute('tabindex')
  })

  it('is focusable and fires onClick on Enter when clickable', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<KpiCard label="Total" value={12} onClick={onClick} />)
    const card = screen.getByRole('button')
    card.focus()
    expect(card).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('fires onClick on Space when clickable', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<KpiCard label="Total" value={12} onClick={onClick} />)
    const card = screen.getByRole('button')
    card.focus()
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('still fires onClick on a plain mouse click (unchanged behaviour)', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<KpiCard label="Total" value={12} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

// KpiBlock shares the exact same clickable-card defect and fix (interactive() from
// lib/a11y) — no dedicated KpiBlock.test.tsx exists on the allowlist, so its
// coverage lives alongside KpiCard's in this file.
describe('KpiBlock', () => {
  it('is not focusable and carries no button role when there is no onClick', () => {
    const { container } = render(<KpiBlock label="Total" value={12} icon={Users} />)
    const card = container.firstElementChild
    expect(card).not.toHaveAttribute('role')
    expect(card).not.toHaveAttribute('tabindex')
  })

  it('is focusable and fires onClick on Enter and Space when clickable', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<KpiBlock label="Total" value={12} icon={Users} onClick={onClick} />)
    const card = screen.getByRole('button')
    card.focus()
    expect(card).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})
