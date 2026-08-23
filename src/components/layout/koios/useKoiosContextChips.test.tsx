import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, renderHook, screen, fireEvent, act } from '@testing-library/react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useKoiosContextChips } from './useKoiosContextChips'
import { SelectionProvider, usePublishSelection } from '@/context/SelectionContext'

// t() echoes the key (plus its interpolation options, for the count/entity
// assertions below) so tests read as the contract, not as Dutch copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => (opts ? `${k}:${JSON.stringify(opts)}` : k) }),
}))

afterEach(() => { window.location.hash = '' })

// A harness that publishes a FIXED selection AND lets the hook under test run
// inside the same provider — drives the selection through the real context
// wiring, not a stub. The Set is built ONCE (not inside Publisher's own render
// body): Publisher consumes SelectionContext (via usePublishSelection), so a
// context-value change forces it to re-render — a Set rebuilt inline there
// would look "changed" to the effect's dep array every time and loop forever
// (setSelection → new context value → forced re-render → new Set →
// setSelection again).
function Publisher({ ids, children }: { ids: Set<string>; children: ReactNode }) {
  usePublishSelection('candidates', ids)
  return <>{children}</>
}
function withSelection(ids: string[]) {
  const idSet = new Set(ids)
  return ({ children }: { children: ReactNode }) => (
    <SelectionProvider><Publisher ids={idSet}>{children}</Publisher></SelectionProvider>
  )
}

describe('useKoiosContextChips — ambient (open drilldown)', () => {
  it('derives a chip from a hash with an open record, named after the record — never the plural nav label', () => {
    window.location.hash = '#candidates?open=c-1'
    const { result } = renderHook(() => useKoiosContextChips(), { wrapper: withSelection([]) })
    expect(result.current.ambientRef?.type).toBe('candidate')
    expect(result.current.ambientRef?.id).toBe('c-1')
    // No cheap name source exists (file banner) — the honest fallback is the
    // SINGULAR entity + id, through the same translation contract as every
    // other label here, never the raw plural "nav.candidates" string.
    expect(result.current.ambientRef?.label).toContain('koios.contextRecordFallback')
    expect(result.current.ambientRef?.label).toContain('koios.mention.singular.candidate')
    expect(result.current.ambientRef?.label).toContain('"id":"c-1"')
  })

  it('has no ambient chip when nothing is open', () => {
    window.location.hash = '#candidates'
    const { result } = renderHook(() => useKoiosContextChips(), { wrapper: withSelection([]) })
    expect(result.current.ambientRef).toBeNull()
  })

  // Dismiss hides the CURRENT record only — a later different open record
  // reinstates the chip.
  it('dismiss hides the ambient chip until a different record opens', () => {
    window.location.hash = '#candidates?open=c-1'
    const { result } = renderHook(() => useKoiosContextChips(), { wrapper: withSelection([]) })
    act(() => result.current.dismissAmbient())
    expect(result.current.ambientRef).toBeNull()
    act(() => { window.location.hash = '#candidates?open=c-2'; window.dispatchEvent(new HashChangeEvent('hashchange')) })
    expect(result.current.ambientRef?.id).toBe('c-2')
  })
})

describe('useKoiosContextChips — selection', () => {
  it('derives a chip from a published selection, with real per-record refs (singular type)', () => {
    const { result } = renderHook(() => useKoiosContextChips(), { wrapper: withSelection(['1', '2']) })
    expect(result.current.selectionChip?.label).toContain('"count":2')
    expect(result.current.selectionChip?.label).toContain('koios.selection.chip')
    // The outgoing refs are the REAL ids, typed 'candidate' (singular, backend-
    // resolvable) — never a synthetic 'selection:candidates' id.
    expect(result.current.selectionChip?.refs).toEqual([
      { type: 'candidate', id: '1', label: '1' },
      { type: 'candidate', id: '2', label: '2' },
    ])
  })

  it('caps the outgoing refs at 5 and marks the overflow on the label', () => {
    const ids = Array.from({ length: 8 }, (_, i) => String(i + 1))
    const { result } = renderHook(() => useKoiosContextChips(), { wrapper: withSelection(ids) })
    expect(result.current.selectionChip?.refs).toHaveLength(5)
    expect(result.current.selectionChip?.refs.map((r) => r.id)).toEqual(['1', '2', '3', '4', '5'])
    expect(result.current.selectionChip?.label).toContain('koios.selection.moreCount')
    expect(result.current.selectionChip?.label).toContain('"count":3')
  })

  it('has no selection chip when nothing is selected', () => {
    const { result } = renderHook(() => useKoiosContextChips(), { wrapper: withSelection([]) })
    expect(result.current.selectionChip).toBeNull()
  })

  // The hook's documented promise: dismiss hides the CURRENT selection only —
  // it reappears the moment the selected id set actually changes. renderHook's
  // `wrapper` cannot receive changing props (only its `render` callback can),
  // so this drives the change through a real rendered harness component with
  // its own state instead — a Set rebuilt only when the STRINGIFIED ids
  // change (same anti-loop guard as `withSelection` above).
  it('dismiss hides the selection chip until the selected id set actually changes', () => {
    function Harness() {
      const [ids, setIds] = useState(['1'])
      const idsKey = ids.join(',')
      // Keyed on the STRINGIFIED list, not `ids` itself — a Set rebuilt on
      // every render (even ones caused by this component's OWN context
      // subscription bouncing back) would loop forever (see the file banner).
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally NOT depending on `ids` (a fresh array every render); idsKey already captures every real change
      const idSet = useMemo(() => new Set(ids), [idsKey])
      usePublishSelection('candidates', idSet)
      const chips = useKoiosContextChips()
      return (
        <div>
          <button onClick={() => chips.dismissSelection()}>dismiss</button>
          <button onClick={() => setIds(['1'])}>same-selection</button>
          <button onClick={() => setIds(['1', '2'])}>different-selection</button>
          <div data-testid="chip">{chips.selectionChip ? chips.selectionChip.refs.map((r) => r.id).join(',') : 'none'}</div>
        </div>
      )
    }
    render(<SelectionProvider><Harness /></SelectionProvider>)
    expect(screen.getByTestId('chip')).toHaveTextContent('1')
    fireEvent.click(screen.getByText('dismiss'))
    expect(screen.getByTestId('chip')).toHaveTextContent('none')
    // Same selection, an unrelated rerender — stays dismissed.
    fireEvent.click(screen.getByText('same-selection'))
    expect(screen.getByTestId('chip')).toHaveTextContent('none')
    // A genuinely different id set — the dismiss no longer applies.
    fireEvent.click(screen.getByText('different-selection'))
    expect(screen.getByTestId('chip')).toHaveTextContent('1,2')
  })
})
