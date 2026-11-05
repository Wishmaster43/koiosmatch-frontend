/**
 * DrawerFilterMenu — NOTES-DOC-FILTER-MENU-1 (Danny 08-08): the shared "Filter"
 * button + anchored popover that replaced the inline type/channel dropdowns in
 * NotesTab and DocumentsSection. Covers the §13 regression list from the task:
 * picking an option narrows via onChange, the badge counts active filters,
 * clear-all resets them, Escape closes (mirrors SelectMenu-inside-useFocusTrap,
 * see SelectMenu.test.tsx), and a nested SelectMenu keeps Escape for itself first.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DrawerFilterMenu from './DrawerFilterMenu'
import type { DrawerFilterConfig } from './DrawerFilterMenu'
import { makeFilters } from './DrawerFilterMenu.testKit'

describe('DrawerFilterMenu · trigger + badge', () => {
  it('renders nothing when no filters are offered (no fake affordance, §3)', () => {
    render(<DrawerFilterMenu filters={[]} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the trigger with no badge when nothing is active', () => {
    render(<DrawerFilterMenu filters={makeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    const trigger = screen.getByRole('button', { name: 'Filter' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('the badge counts exactly the ACTIVE filters', () => {
    render(<DrawerFilterMenu filters={makeFilters({ typeValue: 'call', channelValue: 'phone' })}
      label="Filter" title="Filters" clearAllLabel="Clear all" />)
    // The trigger's accessible name stays "Filter" — the badge is an extra visible span.
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows a count of 1 when only ONE of the two filters is active', () => {
    render(<DrawerFilterMenu filters={makeFilters({ typeValue: 'call' })}
      label="Filter" title="Filters" clearAllLabel="Clear all" />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})

describe('DrawerFilterMenu · panel open/close', () => {
  it('opens the panel on click, showing the title and every filter\'s own label', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const dialog = screen.getByRole('dialog', { name: 'Filters' })
    expect(within(dialog).getByText('Type')).toBeInTheDocument()
    expect(within(dialog).getByText('Channel')).toBeInTheDocument()
  })

  it('closes on outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <button>outside</button>
        <DrawerFilterMenu filters={makeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />
      </div>,
    )
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    const trigger = screen.getByRole('button', { name: 'Filter' })
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('a nested SelectMenu keeps Escape for itself first — a second Escape then closes the panel', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'All types' }))
    expect(screen.getByRole('button', { name: 'Call' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    // The SELECT's own dropdown closed — the panel is still open.
    expect(screen.queryByRole('button', { name: 'Call' })).toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('marks the trigger expanded while the panel is open', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    const trigger = screen.getByRole('button', { name: 'Filter' })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('DrawerFilterMenu · picking a filter value', () => {
  it('picking an option calls the filter\'s own onChange and keeps the panel open', async () => {
    const user = userEvent.setup()
    const onTypeChange = vi.fn()
    render(<DrawerFilterMenu filters={makeFilters({ onTypeChange })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'All types' }))
    await user.click(screen.getByRole('button', { name: 'Call' }))
    expect(onTypeChange).toHaveBeenCalledWith('call')
    // Picking a value narrows the LIST via the host's own state, not this component —
    // the panel itself stays open so a second filter can be picked in the same visit.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('picking the OTHER filter (channel) never calls the type filter\'s onChange', async () => {
    const user = userEvent.setup()
    const onTypeChange = vi.fn()
    const onChannelChange = vi.fn()
    render(<DrawerFilterMenu filters={makeFilters({ onTypeChange, onChannelChange })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'All channels' }))
    await user.click(screen.getByRole('button', { name: 'WhatsApp' }))
    expect(onChannelChange).toHaveBeenCalledWith('whatsapp')
    expect(onTypeChange).not.toHaveBeenCalled()
  })
})

describe('DrawerFilterMenu · clear all', () => {
  it('hides the clear-all button when nothing is active', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull()
  })

  it('shows clear-all once ≥1 filter is active, and it resets every ACTIVE filter to \'\'', async () => {
    const user = userEvent.setup()
    const onTypeChange = vi.fn()
    const onChannelChange = vi.fn()
    render(<DrawerFilterMenu filters={makeFilters({ typeValue: 'call', channelValue: 'phone', onTypeChange, onChannelChange })}
      label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onTypeChange).toHaveBeenCalledWith('')
    expect(onChannelChange).toHaveBeenCalledWith('')
  })

  it('never calls onChange for a filter that was already inactive', async () => {
    const user = userEvent.setup()
    const onTypeChange = vi.fn()
    const onChannelChange = vi.fn()
    render(<DrawerFilterMenu filters={makeFilters({ typeValue: 'call', onTypeChange, onChannelChange })}
      label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onTypeChange).toHaveBeenCalledWith('')
    expect(onChannelChange).not.toHaveBeenCalled()
  })
})

/**
 * TASK-FILTER-MENU-1 (Danny 08-08): the MULTI-select row (task status/type/
 * priority) — an inline searchable checklist, never a nested popover (see the
 * DrawerMultiFilterConfig doc comment in the source for why). Toggling an option
 * must NOT close this panel (the exact bug a portal-based control would cause).
 */
describe('DrawerFilterMenu · multi-select row', () => {
  const makeMultiFilters = (over: Partial<{ selected: string[]; onToggle: (v: string) => void }> = {}): DrawerFilterConfig[] => [{
    type: 'multi', key: 'status', label: 'Status', selected: over.selected ?? [],
    options: [{ value: 'todo', label: 'To do' }, { value: 'done', label: 'Done' }],
    onToggle: over.onToggle ?? vi.fn(), searchPlaceholder: 'Search', noResultsLabel: 'No results',
  }]

  it('shows every option as a checkbox, checked ones reflecting `selected`', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeMultiFilters({ selected: ['todo'] })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getByRole('checkbox', { name: 'To do' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Done' })).not.toBeChecked()
  })

  it('toggling an option calls onToggle and keeps the panel OPEN (never a nested-popover close)', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<DrawerFilterMenu filters={makeMultiFilters({ onToggle })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('checkbox', { name: 'To do' }))
    expect(onToggle).toHaveBeenCalledWith('todo')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('the row\'s own search box narrows its OWN options only', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeMultiFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.type(screen.getByPlaceholderText('Search'), 'don')
    expect(screen.getByRole('checkbox', { name: 'Done' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'To do' })).toBeNull()
  })

  it('the badge counts every SELECTED value, not just whether the row is active', async () => {
    render(<DrawerFilterMenu filters={makeMultiFilters({ selected: ['todo', 'done'] })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('clear-all toggles OFF every currently selected value', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<DrawerFilterMenu filters={makeMultiFilters({ selected: ['todo', 'done'], onToggle })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onToggle).toHaveBeenCalledWith('todo')
    expect(onToggle).toHaveBeenCalledWith('done')
    expect(onToggle).toHaveBeenCalledTimes(2)
  })
})

/**
 * P8-MORE-FILTERS (batch 8, decision = option B): the 'range' and 'date' row
 * types added so the vacancy-search card's secondary filters (Uren per week,
 * Inzetbaar vanaf) can move behind this SAME shared popover — mirrors the
 * multi-select coverage above (badge counts, clear-all, panel stays open).
 */
describe('DrawerFilterMenu · range row', () => {
  const makeRangeFilters = (over: Partial<{ value: [number, number]; active: boolean; onChange: (v: [number, number]) => void; onReset: () => void }> = {}): DrawerFilterConfig[] => [{
    type: 'range', key: 'hours', label: 'Hours', value: over.value ?? [0, 40], max: 40,
    onChange: over.onChange ?? vi.fn(), valueLabel: `${(over.value ?? [0, 40])[0]}–${(over.value ?? [0, 40])[1]}`,
    ariaLabels: ['Hours min', 'Hours max'], active: over.active ?? false, onReset: over.onReset ?? vi.fn(),
  }]

  it('renders two sliders (a two-thumb range control) for the row', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeRangeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getAllByRole('slider')).toHaveLength(2)
  })

  it('the badge counts an active range row as 1, an inactive one as 0', () => {
    const { rerender } = render(<DrawerFilterMenu filters={makeRangeFilters({ active: false })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    expect(screen.queryByText('1')).toBeNull()
    rerender(<DrawerFilterMenu filters={makeRangeFilters({ active: true })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('clear-all calls the range row\'s own onReset, only when active', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    render(<DrawerFilterMenu filters={makeRangeFilters({ active: true, onReset })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
