/**
 * FilterGroupBlock — PARITY-FALLBACK-1 regression: a group with no `type` at
 * all must render as the searchable dropdown (SearchSelectGroup), never the
 * untyped plain checkbox list — the seven-page filter-parity sweep relies on
 * this default so a freshly-typed page never regresses to an unsearchable list.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FilterGroupBlock from './FilterGroupBlock'
import type { ReportFilterGroup } from '@/types/reports'

describe('FilterGroupBlock — untyped group defaults to search-select', () => {
  it('renders the searchable dropdown trigger, not a bare checkbox list', () => {
    // No `type` field at all — mirrors a group built before the typed sweep.
    const group: ReportFilterGroup = {
      key: 'assignee', label: 'Assignee',
      selected: [], options: [{ value: 'u1', label: 'Alice' }, { value: 'u2', label: 'Bob' }],
      onToggle: vi.fn(),
    }
    render(<FilterGroupBlock group={group} collapsed={false} count={0} onToggle={vi.fn()} />)
    // SearchSelectGroup's trigger reads the "choose…" placeholder key; a bare
    // checkbox list would render the option labels as <input type="checkbox"> rows
    // with no trigger button and no search box.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filters.choose/ })).toBeInTheDocument()
  })

  it('opens to a real search box and toggles a value via onToggle', () => {
    const onToggle = vi.fn()
    const group: ReportFilterGroup = {
      key: 'assignee', label: 'Assignee',
      selected: [], options: [{ value: 'u1', label: 'Alice' }, { value: 'u2', label: 'Bob' }],
      onToggle,
    }
    render(<FilterGroupBlock group={group} collapsed={false} count={0} onToggle={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /filters.choose/ }))
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'ali' } })
    fireEvent.click(screen.getByText('Alice'))
    expect(onToggle).toHaveBeenCalledWith('u1')
  })
})
