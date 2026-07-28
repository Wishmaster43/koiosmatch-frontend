import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DrawerTabs from './DrawerTabs'

const tabs = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
]

// DrawerTabs is purely presentational (§3A) — this harness owns `active`
// exactly like the real host, EntityDrawer, does.
function Host({ initial = 'a' }: { initial?: string }) {
  const [active, setActive] = useState(initial)
  return <DrawerTabs tabs={tabs} active={active} onChange={setActive} />
}

// Audit finding (§6, WCAG 2.2 AA): the main drawer tab strip had NO tab
// semantics at all — plain buttons, announced as "button, button, button"
// instead of a tab interface. Now matches SubTabBar exactly (shared
// useRovingTabs hook) — two tab strips in one product must not expose two
// different keyboard models.
describe('DrawerTabs · tablist keyboard model (§6 WCAG 2.2 AA)', () => {
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
  })

  it('ArrowLeft wraps from the first tab to the last', async () => {
    const user = userEvent.setup()
    render(<Host />)
    screen.getByRole('tab', { name: 'Alpha' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Charlie' })).toHaveAttribute('aria-selected', 'true')
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

  it('renders the optional badge alongside the label', () => {
    render(<DrawerTabs tabs={[{ id: 'a', label: 'Alpha', badge: 3 }]} active="a" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Alpha 3' })).toBeInTheDocument()
  })
})
