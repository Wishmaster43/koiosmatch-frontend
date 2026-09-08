import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BulkActionsBar from './BulkActionsBar'
import type { MenuNode } from './ActionMenu'

describe('BulkActionsBar', () => {
  it('renders the selected count label and clear button', () => {
    const onClear = vi.fn()
    render(
      <BulkActionsBar
        onClear={onClear}
        items={[]}
        labels={{ selected: '3 selected', clear: 'Deselect', actions: 'Actions' }}
      />
    )
    expect(screen.getByText('3 selected')).toBeInTheDocument()
    expect(screen.getByText('Deselect')).toBeInTheDocument()
  })

  it('fires onClear when the clear button is clicked', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <BulkActionsBar
        onClear={onClear}
        items={[]}
        labels={{ selected: '1 selected', clear: 'Deselect', actions: 'Actions' }}
      />
    )
    await user.click(screen.getByText('Deselect'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('renders the actions menu with the provided label and items', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const items: MenuNode[] = [
      {
        key: 'test',
        label: 'Test Action',
        options: [{ value: 'a', label: 'Option A' }],
        onPick,
      },
    ]
    render(
      <BulkActionsBar
        onClear={vi.fn()}
        items={items}
        labels={{ selected: '2 selected', clear: 'Deselect', actions: 'Do things' }}
      />
    )
    await user.click(screen.getByText('Do things'))
    expect(screen.getByText('Test Action')).toBeInTheDocument()
  })
})
