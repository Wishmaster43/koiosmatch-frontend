import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SubTabBar from './SubTabBar'

const tabs = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
]

// SubTabBar is purely presentational (§3A) — this harness owns `active` exactly
// like a real host (EntityDrawer / a tab component) would.
function Host({ initial = 'a' }: { initial?: string }) {
  const [active, setActive] = useState(initial)
  return <SubTabBar tabs={tabs} active={active} onChange={setActive} />
}

// Audit finding (§6, WCAG 2.2 AA): SubTabBar declared role="tablist"/"tab" +
// aria-selected but implemented no arrow-key navigation — a screen reader was
// told "tab strip" while arrow keys did nothing. Covers the full WAI-ARIA tabs
// keyboard model (roving tabindex + Left/Right/Home/End, wrapping at the ends).
describe('SubTabBar · tablist keyboard model (§6 WCAG 2.2 AA)', () => {
  it('exposes tab/tablist roles with aria-selected following the active tab', () => {
    render(<Host />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveAttribute('aria-selected', 'false')
  })

  it('roving tabindex: only the active tab sits in the natural Tab order', () => {
    render(<Host />)
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowRight moves focus and selection to the next tab', async () => {
    const user = userEvent.setup()
    render(<Host />)
    screen.getByRole('tab', { name: 'Alpha' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'false')
  })

  it('ArrowLeft wraps from the first tab to the last', async () => {
    const user = userEvent.setup()
    render(<Host />)
    screen.getByRole('tab', { name: 'Alpha' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveFocus()
  })

  it('ArrowRight wraps from the last tab to the first', async () => {
    const user = userEvent.setup()
    render(<Host initial="c" />)
    screen.getByRole('tab', { name: 'Charlie' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
  })

  it('End jumps to the last tab, Home jumps back to the first', async () => {
    const user = userEvent.setup()
    render(<Host />)
    screen.getByRole('tab', { name: 'Alpha' }).focus()
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
  })
})
