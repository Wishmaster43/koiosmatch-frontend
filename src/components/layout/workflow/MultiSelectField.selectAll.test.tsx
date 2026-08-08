import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MultiSelectField from './MultiSelectField'
import type { WorkflowField } from '@/types/workflow'

// The workflow config multi-select reads tenant lookups through LookupsContext; these
// tests drive the STATIC option path, so the context is stubbed with empty lists.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ statuses: [], phases: [], candidateTypes: [] }),
}))

// Without an i18n instance `optionLabel` falls back to the raw value, so label === value.
const field = { key: 'status', label: 'Status', options: ['open', 'onhold', 'archived'] } as unknown as WorkflowField
const selectAllButton = () => screen.getByRole('button', { name: /multiSelect\.(selectVisible|clearVisible)/ })
const searchBox = () => screen.getByRole('textbox')

describe('MultiSelectField · select all', () => {
  it('adds every visible option in one call (this host owns the whole array)', () => {
    const onChange = vi.fn()
    render(<MultiSelectField field={field} value={[]} onChange={onChange} />)
    fireEvent.click(searchBox())

    fireEvent.click(selectAllButton())
    expect(onChange).toHaveBeenCalledWith('status', ['open', 'onhold', 'archived'])
  })

  it('restricts itself to the options the search shows', () => {
    const onChange = vi.fn()
    render(<MultiSelectField field={field} value={[]} onChange={onChange} />)
    // 'o' matches open + onhold, never archived.
    fireEvent.change(searchBox(), { target: { value: 'o' } })

    expect(selectAllButton().textContent).toContain('2')
    fireEvent.click(selectAllButton())
    expect(onChange).toHaveBeenCalledWith('status', ['open', 'onhold'])
  })

  it('clears only the visible options, keeping a selection made outside the filter', () => {
    const onChange = vi.fn()
    render(<MultiSelectField field={field} value={['open', 'onhold', 'archived']} onChange={onChange} />)
    fireEvent.change(searchBox(), { target: { value: 'o' } })

    expect(selectAllButton().textContent).toContain('multiSelect.clearVisible')
    fireEvent.click(selectAllButton())
    expect(onChange).toHaveBeenCalledWith('status', ['archived'])
  })

  it('offers no select-all in free-entry mode (there is no option list)', () => {
    const freeField = { key: 'city', label: 'Plaats' } as unknown as WorkflowField
    render(<MultiSelectField field={freeField} value={[]} onChange={vi.fn()} />)
    fireEvent.click(searchBox())
    expect(screen.queryByRole('button', { name: /multiSelect\./ })).not.toBeInTheDocument()
  })
})
