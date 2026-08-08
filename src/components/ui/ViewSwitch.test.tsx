/**
 * ViewSwitch — regression coverage for the show/hide contract (heraudit-2 point 1).
 * A view toggle must never unmount the table (that defeats the row virtualizer's
 * scroll-state and forces a remeasure, APPS-VIRT-1) — so this proves the wrapper
 * (a) never mounts a view before its first activation, (b) keeps a once-activated
 * view IN THE DOM (state survives) when it becomes inactive, and (c) flips display
 * contents/none rather than adding/removing the subtree.
 */
import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ViewSwitch from './ViewSwitch'

// A stateful child so a remount is observable: its own counter would reset to 0
// if ViewSwitch ever unmounted it instead of just hiding it via CSS.
function Counter({ testId }: { testId: string }) {
  const [n, setN] = useState(0)
  return <button data-testid={testId} onClick={() => setN(v => v + 1)}>{n}</button>
}

const views = [
  { id: 'table', render: () => <Counter testId="table-counter" /> },
  { id: 'map', render: () => <Counter testId="map-counter" /> },
]

describe('ViewSwitch', () => {
  it('mounts only the active view on first render', () => {
    render(<ViewSwitch active="table" views={views} />)
    expect(screen.getByTestId('table-counter')).toBeInTheDocument()
    expect(screen.queryByTestId('map-counter')).not.toBeInTheDocument()
  })

  it('keeps a previously-active view mounted (display:none) instead of unmounting it', () => {
    const { rerender } = render(<ViewSwitch active="table" views={views} />)
    rerender(<ViewSwitch active="map" views={views} />)
    // Both subtrees are now in the DOM — the inactive one hidden via CSS, not removed.
    const tableNode = screen.getByTestId('table-counter')
    const mapNode = screen.getByTestId('map-counter')
    expect(tableNode).toBeInTheDocument()
    expect(mapNode).toBeInTheDocument()
    expect(tableNode.parentElement).toHaveStyle({ display: 'none' })
    expect(mapNode.parentElement).toHaveStyle({ display: 'contents' })
  })

  it('preserves a view\'s internal state across a toggle away and back (no remount)', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ViewSwitch active="table" views={views} />)
    await user.click(screen.getByTestId('table-counter'))
    expect(screen.getByTestId('table-counter')).toHaveTextContent('1')

    // Switch to map, then back to table — a remount would reset the counter to 0.
    rerender(<ViewSwitch active="map" views={views} />)
    rerender(<ViewSwitch active="table" views={views} />)
    expect(screen.getByTestId('table-counter')).toHaveTextContent('1')
  })

  it('never mounts a view that has not been activated yet', () => {
    render(<ViewSwitch active="table" views={views} />)
    // The map view (e.g. a lazy-loaded Leaflet pane) stays out of the tree until
    // it is actually selected once — so it doesn't defeat route-level code-splitting.
    expect(screen.queryByTestId('map-counter')).not.toBeInTheDocument()
  })
})
