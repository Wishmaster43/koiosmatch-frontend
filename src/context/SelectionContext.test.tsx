import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useState } from 'react'
import { SelectionProvider, useSelectionContext, usePublishSelection } from './SelectionContext'

// A minimal publisher page: mirrors the mechanical ×8 call site — one
// usePublishSelection line fed by a local selectedIds Set.
function Publisher({ ids }: { ids: Set<string> }) {
  usePublishSelection('candidates', ids)
  return null
}

// A minimal reader, standing in for KoiosPanel's own consumption of the slot.
function Reader() {
  const { selection } = useSelectionContext()
  return <div>{selection ? `${selection.entity}:${selection.ids.join(',')}` : 'none'}</div>
}

describe('SelectionContext', () => {
  // No selection published yet — the default slot value.
  it('starts empty with no publisher', () => {
    render(<SelectionProvider><Reader /></SelectionProvider>)
    expect(screen.getByText('none')).toBeInTheDocument()
  })

  // A page's non-empty selectedIds Set publishes into the shared slot.
  it('publishes a non-empty selection', () => {
    render(<SelectionProvider><Publisher ids={new Set(['1', '2'])} /><Reader /></SelectionProvider>)
    expect(screen.getByText('candidates:1,2')).toBeInTheDocument()
  })

  // Emptying the Set clears the slot back to null (KOIOS-SELECTIE-CONTEXT-1:
  // "clearing on empty selection").
  it('clears the slot when the selection empties', () => {
    function Harness() {
      const [ids, setIds] = useState(new Set(['1']))
      return (
        <SelectionProvider>
          <Publisher ids={ids} />
          <Reader />
          <button onClick={() => setIds(new Set())}>clear</button>
        </SelectionProvider>
      )
    }
    render(<Harness />)
    expect(screen.getByText('candidates:1')).toBeInTheDocument()
    act(() => { screen.getByText('clear').click() })
    expect(screen.getByText('none')).toBeInTheDocument()
  })

  // Unmounting the publisher (a page switch) clears the slot too, so a stale
  // selection never survives navigating to a different page.
  it('clears the slot when the publisher unmounts', () => {
    function Harness({ mounted }: { mounted: boolean }) {
      return (
        <SelectionProvider>
          {mounted && <Publisher ids={new Set(['1'])} />}
          <Reader />
        </SelectionProvider>
      )
    }
    const { rerender } = render(<Harness mounted />)
    expect(screen.getByText('candidates:1')).toBeInTheDocument()
    rerender(<Harness mounted={false} />)
    expect(screen.getByText('none')).toBeInTheDocument()
  })

  // setSelection outside a Provider is a safe no-op (default context value) —
  // KoiosPanel must never crash when rendered in isolation in its own tests.
  it('has a harmless default outside a Provider', () => {
    render(<Reader />)
    expect(screen.getByText('none')).toBeInTheDocument()
  })
})
