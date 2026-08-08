import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import DrawerFilterMenu from './DrawerFilterMenu'
import type { DrawerFilterConfig } from './DrawerFilterMenu'

// The drawer filter panel's MULTI rows (task status/type/priority) are searchable
// checklists too, so Danny punt 7 applies there as well.
const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'opgepakt', label: 'Opgepakt' },
  { value: 'done', label: 'Afgerond' },
]

// Host with the same stale-closure toggle shape the real tabs use.
function Host({ options = STATUSES }: { options?: { value: string; label: string }[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (v: string) =>
    setSelected(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  const filters: DrawerFilterConfig[] = [{
    type: 'multi', key: 'status', label: 'Status', selected, options, onToggle: toggle,
    searchPlaceholder: 'Zoek status', noResultsLabel: 'Geen resultaten',
  }]
  return (
    <div>
      <DrawerFilterMenu filters={filters} label="Filter" title="Filters" clearAllLabel="Alles wissen" />
      <output data-testid="selected">{selected.join(',')}</output>
    </div>
  )
}

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
const selectAllButton = () => screen.getByRole('button', { name: /multiSelect\.(selectVisible|clearVisible)/ })

describe('DrawerFilterMenu · select all on a multi row', () => {
  it('selects exactly the rows the row search shows', () => {
    render(<Host />)
    openPanel()
    fireEvent.change(screen.getByPlaceholderText('Zoek status'), { target: { value: 'op' } })

    // "Open" and "Opgepakt" match, "Afgerond" does not.
    expect(selectAllButton().textContent).toContain('2')
    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe('open,opgepakt')
  })

  it('clicking it again clears exactly those rows', () => {
    render(<Host />)
    openPanel()
    fireEvent.change(screen.getByPlaceholderText('Zoek status'), { target: { value: 'op' } })
    fireEvent.click(selectAllButton())
    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe('')
  })

  it('is absent on a single-choice row (§ punt 3)', () => {
    const filters: DrawerFilterConfig[] = [{
      type: 'single', key: 'type', label: 'Type', value: '', options: STATUSES,
      onChange: () => {}, allLabel: 'Alle types',
    }]
    render(<DrawerFilterMenu filters={filters} label="Filter" title="Filters" clearAllLabel="Alles wissen" />)
    openPanel()
    expect(screen.queryByRole('button', { name: /multiSelect\./ })).not.toBeInTheDocument()
  })
})
