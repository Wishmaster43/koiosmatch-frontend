import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchSelectGroup from './SearchSelectGroup'
import type { ReportFilterGroup } from '@/types/reports'

// The list/report filter sidebar's searchable multi-select group — same Danny punt 7
// action as the pickers, same "only what the search shows" rule.
const FUNCTIONS = [
  { value: 'vpk', label: 'Verpleegkundige' },
  { value: 'vig', label: 'Verzorgende IG' },
  { value: 'kok', label: 'Kok' },
]

function Host() {
  const [selected, setSelected] = useState<Array<string | number>>([])
  // Stale-closure toggle — the shape the pages actually pass in.
  const onToggle = (v: string | number) =>
    setSelected(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  const group: ReportFilterGroup = {
    key: 'function', label: 'Functie', type: 'search-select', options: FUNCTIONS, selected, onToggle,
  }
  return (
    <div>
      <SearchSelectGroup group={group} />
      <output data-testid="selected">{selected.join(',')}</output>
    </div>
  )
}

const openGroup = () => fireEvent.click(screen.getByRole('button', { name: /filters\.choose/ }))
const selectAllButton = () => screen.getByRole('button', { name: /multiSelect\.(selectVisible|clearVisible)/ })

describe('SearchSelectGroup · select all', () => {
  it('selects exactly the search hits, then clears them on a second click', () => {
    render(<Host />)
    openGroup()
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'ver' } })

    expect(selectAllButton().textContent).toContain('2')
    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe('vpk,vig')

    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe('')
  })

  it('hides the action when the search has no hits', () => {
    render(<Host />)
    openGroup()
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'zzz' } })
    expect(screen.queryByRole('button', { name: /multiSelect\./ })).not.toBeInTheDocument()
  })
})
