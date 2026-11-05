/** DrawerFilterMenu · toggle, date and width rows (split from DrawerFilterMenu.test.tsx; the trigger, single, multi and range rows stay there). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DrawerFilterMenu from './DrawerFilterMenu'
import type { DrawerFilterConfig } from './DrawerFilterMenu'
import { makeFilters } from './DrawerFilterMenu.testKit'

/**
 * K-288 (linked-notes "Alleen directe notities" switch): a minimal boolean row
 * — the shared Toggle atom, no options/all-label, same badge/clear-all wiring
 * as every other row type.
 */
describe('DrawerFilterMenu · toggle row', () => {
  const makeToggleFilters = (over: Partial<{ value: boolean; onChange: (v: boolean) => void }> = {}): DrawerFilterConfig[] => [{
    type: 'toggle', key: 'onlyDirect', label: 'Only direct', ariaLabel: 'Only direct',
    value: over.value ?? false, onChange: over.onChange ?? vi.fn(),
  }]

  it('renders a switch reflecting the current value', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeToggleFilters({ value: true })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getByRole('switch', { name: 'Only direct' })).toBeChecked()
  })

  it('clicking the switch calls onChange with the flipped value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DrawerFilterMenu filters={makeToggleFilters({ onChange })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('switch', { name: 'Only direct' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('the badge counts an ON toggle as 1, an OFF one as 0', () => {
    const { rerender } = render(<DrawerFilterMenu filters={makeToggleFilters({ value: false })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    expect(screen.queryByText('1')).toBeNull()
    rerender(<DrawerFilterMenu filters={makeToggleFilters({ value: true })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('clear-all switches an ON toggle back off', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DrawerFilterMenu filters={makeToggleFilters({ value: true, onChange })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onChange).toHaveBeenCalledWith(false)
  })
})

describe('DrawerFilterMenu · date row', () => {
  const makeDateFilters = (over: Partial<{ value: string; onChange: (v: string) => void }> = {}): DrawerFilterConfig[] => [{
    type: 'date', key: 'availableFrom', label: 'Available from', value: over.value ?? '',
    onChange: over.onChange ?? vi.fn(), placeholder: 'Pick a date',
  }]

  it('renders a text input (the shared datepicker), never a native <input type="date">', async () => {
    const user = userEvent.setup()
    const { container } = render(<DrawerFilterMenu filters={makeDateFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(screen.getByPlaceholderText('Pick a date')).toBeInTheDocument()
  })

  it('the badge counts a set date value as active, an empty one as inactive', () => {
    const { rerender } = render(<DrawerFilterMenu filters={makeDateFilters({ value: '' })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    expect(screen.queryByText('1')).toBeNull()
    rerender(<DrawerFilterMenu filters={makeDateFilters({ value: '2026-08-20' })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('picking a day in the portal-rendered calendar does NOT close the panel (outside-click whitelist)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DrawerFilterMenu filters={makeDateFilters({ onChange })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByPlaceholderText('Pick a date'))
    // The calendar renders into the shared #datepicker-portal node, OUTSIDE this
    // panel's own DOM subtree — exactly the case the whitelist exists for.
    const anyDay = document.querySelector('.react-datepicker__day:not(.react-datepicker__day--outside-month)') as HTMLElement
    expect(anyDay).toBeTruthy()
    await user.click(anyDay)
    expect(onChange).toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('clear-all calls onChange(\'\') only for an active date row', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DrawerFilterMenu filters={makeDateFilters({ value: '2026-08-20', onChange })} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})

/**
 * FILTER-WIDTH-1 (Danny 08-08, punt 13 "filter notities moet langer zijn" + punt 18
 * "filter bij documenten is te kort hierdoor kan je niet goed filteren"). The defect
 * was purely dimensional — a 230px panel whose option labels were clipped with an
 * ellipsis, so two real lookup values could not be told apart before picking one.
 * These guard the two things that actually broke: the panel is wide, and a long
 * label WRAPS instead of being cut off. Asserted on the inline styles this file
 * owns, which is where the regression would land.
 */
describe('DrawerFilterMenu · usable width (punten 13 + 18)', () => {
  const LONG = 'Verklaring Omtrent het Gedrag (VOG) — zorgprofessionals'

  // FILTER-CLIP-1 (Danny 09-08, screenshot): the panel must never CLIP, or the
  // nested dropdown opens as a two-row scrollbox inside it. This is the assertion
  // that actually protects filtering — the earlier width numbers were the wrong axis.
  it('never clips its content, so a nested dropdown can open past the panel', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const panel = screen.getByRole('dialog', { name: 'Filters' })
    // No clipping ancestor: neither `overflow` on the panel nor a scrolling body.
    expect(panel.style.overflow).toBe('')
    const body = panel.lastElementChild as HTMLElement
    expect(body.style.overflowY).toBe('')
    expect(body.style.maxHeight).toBe('')
    // Narrow by design (Danny: "smaller maken en langer") but never wider than a
    // laptop drawer, so the page cannot scroll sideways.
    expect(parseInt(panel.style.width, 10)).toBeLessThanOrEqual(300)
    expect(panel.style.maxWidth).toBe('calc(100vw - 24px)')
  })

  it('gives the single-select dropdown the panel\'s full inner width, so its menu is never narrower than its trigger', async () => {
    const user = userEvent.setup()
    render(<DrawerFilterMenu filters={makeFilters()} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const trigger = screen.getByRole('button', { name: 'All types' })
    await user.click(trigger)
    // The listbox the trigger controls carries the width the panel handed down.
    const menu = document.getElementById(trigger.getAttribute('aria-controls') as string)
    expect(menu).not.toBeNull()
    // Matches the panel's inner width (panel - border - padding), so the option
    // list is never narrower than the trigger that opened it, at any panel size.
    expect(parseInt((menu as HTMLElement).style.minWidth, 10)).toBe(238)
  })

  it('wraps a long multi-select option instead of truncating it', async () => {
    const user = userEvent.setup()
    const filters: DrawerFilterConfig[] = [{
      type: 'multi', key: 'status', label: 'Status', selected: [],
      options: [{ value: 'vog', label: LONG }],
      onToggle: vi.fn(), searchPlaceholder: 'Search', noResultsLabel: 'No results',
    }]
    render(<DrawerFilterMenu filters={filters} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    const label = screen.getByText(LONG)
    expect(label.style.whiteSpace).not.toBe('nowrap')
    expect(label.style.textOverflow).not.toBe('ellipsis')
  })

  it('keeps the full option text available to a screen reader (never a clipped name)', async () => {
    const user = userEvent.setup()
    const filters: DrawerFilterConfig[] = [{
      type: 'multi', key: 'status', label: 'Status', selected: [],
      options: [{ value: 'vog', label: LONG }],
      onToggle: vi.fn(), searchPlaceholder: 'Search', noResultsLabel: 'No results',
    }]
    render(<DrawerFilterMenu filters={filters} label="Filter" title="Filters" clearAllLabel="Clear all" />)
    await user.click(screen.getByRole('button', { name: 'Filter' }))
    expect(screen.getByRole('checkbox', { name: LONG })).toBeInTheDocument()
  })
})
