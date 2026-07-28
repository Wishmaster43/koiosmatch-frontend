/**
 * SearchSelectGroup — a11y regression test (audit fix): the dropdown's own
 * search-query clear button and the selected-tag remove button were both
 * icon-only with no accessible name. i18n isn't initialised in tests, so
 * t('filters.clear') resolves to the raw key (mirrors ReportFilterSidebar.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchSelectGroup from './SearchSelectGroup'
import type { ReportFilterGroup } from '@/types/reports'

function makeGroup(overrides: Partial<ReportFilterGroup> = {}): ReportFilterGroup {
  return {
    key: 'workflow', label: 'Workflow', type: 'search-select',
    selected: ['wf-1'],
    options: [{ value: 'wf-1', label: 'Welcome flow' }, { value: 'wf-2', label: 'Reminder flow' }],
    onToggle: vi.fn(),
    ...overrides,
  }
}

describe('SearchSelectGroup — icon-only buttons have an accessible name', () => {
  it('labels the selected-tag remove button and wires it to onToggle', () => {
    const onToggle = vi.fn()
    render(<SearchSelectGroup group={makeGroup({ onToggle })} />)
    // The selected-tags row lives inside the dropdown body, so open it first
    // (trigger button shows the single selection's label when open === false).
    fireEvent.click(screen.getByRole('button', { name: /Welcome flow/ }))
    const removeButton = screen.getByLabelText('filters.clear')
    fireEvent.click(removeButton)
    expect(onToggle).toHaveBeenCalledWith('wf-1')
  })

  it('labels the dropdown search-query clear button', () => {
    render(<SearchSelectGroup group={makeGroup()} />)
    // Open the dropdown (trigger button shows the selection count/label).
    fireEvent.click(screen.getByRole('button', { name: /Welcome flow/ }))
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'wel' } })
    // Now two buttons share the label: the query-clear one and the selected tag's.
    const clearButtons = screen.getAllByLabelText('filters.clear')
    expect(clearButtons.length).toBe(2)
  })
})
