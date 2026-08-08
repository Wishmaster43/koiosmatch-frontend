import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ChipMultiSelect from './ChipMultiSelect'

// Chip rows are multi-select too, and their longest lists (branches, locations,
// industries) are exactly where ticking one by one hurts (Danny punt 7).
const BRANCHES = [
  { value: 'ams', label: 'Amsterdam' },
  { value: 'rtm', label: 'Rotterdam' },
  { value: 'utr', label: 'Utrecht' },
]

function Host({ options = BRANCHES }: { options?: { value: string; label: string }[] }) {
  const [selected, setSelected] = useState<string[]>([])
  // Stale-closure toggle — the shape RolesSettings/EditUserModal actually pass.
  const onToggle = (v: string) =>
    setSelected(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  return (
    <div>
      <ChipMultiSelect options={options} values={selected} onToggle={onToggle} ariaLabel="Vestigingen" />
      <output data-testid="selected">{selected.join(',')}</output>
    </div>
  )
}

const selectAllButton = () => screen.getByRole('button', { name: /multiSelect\.(selectVisible|clearVisible)/ })

describe('ChipMultiSelect · select all', () => {
  it('ticks every chip in one click and clears them on the second', () => {
    render(<Host />)
    expect(selectAllButton().textContent).toContain('3')

    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe('ams,rtm,utr')

    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe('')
  })

  it('adds only the chips that were still off', () => {
    render(<Host />)
    fireEvent.click(screen.getByRole('button', { name: 'Rotterdam' }))
    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe('rtm,ams,utr')
  })

  it('stays out of the way for a one-option list (nothing to batch)', () => {
    render(<Host options={[{ value: 'ams', label: 'Amsterdam' }]} />)
    expect(screen.queryByRole('button', { name: /multiSelect\./ })).not.toBeInTheDocument()
  })

  it('can be switched off by a call site that does not want it', () => {
    render(<ChipMultiSelect options={BRANCHES} values={[]} onToggle={() => {}} selectAll={false} />)
    expect(screen.queryByRole('button', { name: /multiSelect\./ })).not.toBeInTheDocument()
  })
})
