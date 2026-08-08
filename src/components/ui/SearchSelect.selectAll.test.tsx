import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchSelect from './SearchSelect'

// Danny punt 7: "select all in alle zoekbare dropdowns zoals functies etc." — every
// function had to be ticked one by one. The action must act on what the SEARCH SHOWS,
// never on the full vocabulary.
const FUNCTIONS = ['Verpleegkundige', 'Verzorgende IG', 'Chauffeur', 'Kok']

// A host with the SAME shape as the real call sites (VacancySearchTab,
// CandidateSearchTab, ContactLinkSection): a NON-functional setState closure. A naive
// `values.forEach(onToggle)` would let every call read the same stale `selected`, so
// only the last value would survive — the exact fake affordance this must not be.
function StaleClosureHost({ options = FUNCTIONS }: { options?: string[] }) {
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (v: string) =>
    setSelected(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  return (
    <div>
      <SearchSelect triggerLabel="Functie toevoegen" options={options} selected={selected} onToggle={toggle} />
      <output data-testid="selected">{selected.join(',')}</output>
    </div>
  )
}

const openPicker = () => fireEvent.click(screen.getByRole('button', { name: /Functie toevoegen/ }))
const selectAllButton = () => screen.getByRole('button', { name: /multiSelect\.(selectVisible|clearVisible)/ })

describe('SearchSelect · select all', () => {
  it('selects exactly the options the active search shows, not the whole list', () => {
    render(<StaleClosureHost />)
    openPicker()
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'ver' } })

    // The row names its scope: the 2 visible matches.
    expect(selectAllButton().textContent).toContain('2')

    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe('Verpleegkundige,Verzorgende IG')
  })

  it('clicking it again clears exactly those same options', () => {
    render(<StaleClosureHost />)
    openPicker()
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'ver' } })
    fireEvent.click(selectAllButton())

    // Everything visible is now selected → the row offers the reverse action.
    expect(selectAllButton().textContent).toContain('multiSelect.clearVisible')
    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe('')
  })

  it('leaves a selection made outside the current filter untouched', () => {
    render(<StaleClosureHost />)
    openPicker()
    fireEvent.click(screen.getByRole('button', { name: 'Kok' }))
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'ver' } })
    fireEvent.click(selectAllButton())

    expect(screen.getByTestId('selected').textContent).toBe('Kok,Verpleegkundige,Verzorgende IG')
  })

  it('selects the full list when no search filter is active', () => {
    render(<StaleClosureHost />)
    openPicker()
    fireEvent.click(selectAllButton())
    expect(screen.getByTestId('selected').textContent).toBe(FUNCTIONS.join(','))
  })

  it('hides the action while the search has no hits (nothing to select)', () => {
    render(<StaleClosureHost />)
    openPicker()
    fireEvent.change(screen.getByPlaceholderText('search'), { target: { value: 'zzz' } })
    expect(screen.queryByRole('button', { name: /multiSelect\./ })).not.toBeInTheDocument()
  })

  // Requirement 3: single-choice lists never get the action.
  it('is absent on a single-choice dropdown (closeOnToggle)', () => {
    render(<SearchSelect triggerLabel="Kies" options={FUNCTIONS} selected={[]} onToggle={() => {}} closeOnToggle />)
    fireEvent.click(screen.getByRole('button', { name: /Kies/ }))
    expect(screen.queryByRole('button', { name: /multiSelect\./ })).not.toBeInTheDocument()
  })

  it('is absent when a single-pick call site opts out with selectAll={false}', () => {
    render(<SearchSelect triggerLabel="Kies" options={FUNCTIONS} selected={[]} onToggle={() => {}} selectAll={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Kies/ }))
    expect(screen.queryByRole('button', { name: /multiSelect\./ })).not.toBeInTheDocument()
  })

  it('keeps the search box focused, so you can keep typing after selecting all', () => {
    render(<StaleClosureHost />)
    openPicker()
    const input = screen.getByPlaceholderText('search')
    fireEvent.mouseDown(selectAllButton())
    fireEvent.click(selectAllButton())
    expect(document.activeElement).toBe(input)
  })

  it('does not close the picker (a batch pick is not a final pick)', () => {
    const onToggle = vi.fn()
    render(<SearchSelect triggerLabel="Functie toevoegen" options={FUNCTIONS} selected={[]} onToggle={onToggle} />)
    openPicker()
    fireEvent.mouseDown(selectAllButton())
    fireEvent.click(selectAllButton())
    expect(screen.getByPlaceholderText('search')).toBeInTheDocument()
  })
})
