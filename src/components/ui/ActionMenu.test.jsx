import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ActionMenu from './ActionMenu'

// Build a small menu: one searchable option-list node + one leaf action.
const buildItems = (onPick, onSelect) => [
  {
    key: 'pool', label: 'Add to pool', searchPlaceholder: 'Search pool', emptyText: 'No pools',
    options: [{ value: 'p1', label: 'Spoed' }, { value: 'p2', label: 'Vast team' }], onPick,
  },
  { key: 'del', label: 'Delete', onSelect },
]

describe('ActionMenu', () => {
  it('keeps the menu closed until the trigger is clicked', () => {
    render(<ActionMenu label="Bulk" items={buildItems(vi.fn(), vi.fn())} />)
    expect(screen.getByText('Bulk')).toBeInTheDocument()
    expect(screen.queryByText('Add to pool')).toBeNull()
  })

  it('opens the root level on click', async () => {
    const user = userEvent.setup()
    render(<ActionMenu label="Bulk" items={buildItems(vi.fn(), vi.fn())} />)
    await user.click(screen.getByText('Bulk'))
    expect(screen.getByText('Add to pool')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('drills into an option list and picks an option', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<ActionMenu label="Bulk" items={buildItems(onPick, vi.fn())} />)
    await user.click(screen.getByText('Bulk'))
    await user.click(screen.getByText('Add to pool'))
    // Drilled in: search box + the two options are shown.
    expect(screen.getByPlaceholderText('Search pool')).toBeInTheDocument()
    expect(screen.getByText('Spoed')).toBeInTheDocument()
    await user.click(screen.getByText('Vast team'))
    expect(onPick).toHaveBeenCalledWith('p2')
    // Menu closed again after picking.
    expect(screen.queryByPlaceholderText('Search pool')).toBeNull()
  })

  it('filters options by the search query', async () => {
    const user = userEvent.setup()
    render(<ActionMenu label="Bulk" items={buildItems(vi.fn(), vi.fn())} />)
    await user.click(screen.getByText('Bulk'))
    await user.click(screen.getByText('Add to pool'))
    await user.type(screen.getByPlaceholderText('Search pool'), 'vast')
    expect(screen.getByText('Vast team')).toBeInTheDocument()
    expect(screen.queryByText('Spoed')).toBeNull()
  })

  it('fires a leaf action and closes', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ActionMenu label="Bulk" items={buildItems(vi.fn(), onSelect)} />)
    await user.click(screen.getByText('Bulk'))
    await user.click(screen.getByText('Delete'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Delete')).toBeNull()
  })

  it('steps back from a sub-level to the root', async () => {
    const user = userEvent.setup()
    render(<ActionMenu label="Bulk" items={buildItems(vi.fn(), vi.fn())} />)
    await user.click(screen.getByText('Bulk'))
    await user.click(screen.getByText('Add to pool'))
    // Esc steps back one level: the search box disappears, the root rows return.
    await user.keyboard('{Escape}')
    expect(screen.queryByPlaceholderText('Search pool')).toBeNull()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('drills into a free-text input node and submits the text', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const items = [{ key: 'note', label: 'Add note', input: true, placeholder: 'Write a note', submitLabel: 'Save', onSubmit }]
    render(<ActionMenu label="Bulk" items={items} />)
    await user.click(screen.getByText('Bulk'))
    await user.click(screen.getByText('Add note'))
    await user.type(screen.getByPlaceholderText('Write a note'), 'Called, no answer')
    await user.click(screen.getByText('Save'))
    expect(onSubmit).toHaveBeenCalledWith('Called, no answer')
    expect(screen.queryByPlaceholderText('Write a note')).toBeNull()
  })
})
