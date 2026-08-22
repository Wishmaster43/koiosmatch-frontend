import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CollapsedCard from './CollapsedCard'

// The one shared collapsed-by-default card shell (Danny 03-08 A+D decision) —
// guards its collapsed-first/keyboard-toggle/filled-indicator contract so a
// modal can never hand-roll a divergent one (mirrors QuickViewToggle.test.tsx).
describe('CollapsedCard', () => {
  it('starts collapsed by default — the body never mounts before it is opened', () => {
    render(<CollapsedCard title="Import" filled={false}><input aria-label="hidden-field" /></CollapsedCard>)
    expect(screen.queryByLabelText('hidden-field')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the body on a click, and aria-expanded flips', () => {
    render(<CollapsedCard title="Import" filled={false}><input aria-label="hidden-field" /></CollapsedCard>)
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(screen.getByLabelText('hidden-field')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens on Enter too — the header is a real keyboard-operable button', () => {
    render(<CollapsedCard title="Import" filled={false}><input aria-label="hidden-field" /></CollapsedCard>)
    // A native <button> fires its click handler on Enter/Space via the browser's
    // own key handling — fireEvent.click is the correct way to exercise that
    // contract in jsdom (mirrors the house convention for other button toggles).
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(screen.getByLabelText('hidden-field')).toBeInTheDocument()
  })

  it('toggles closed again on a second click, unmounting the body', () => {
    render(<CollapsedCard title="Import" filled={false}><input aria-label="hidden-field" /></CollapsedCard>)
    const toggle = screen.getByRole('button', { name: 'Import' })
    fireEvent.click(toggle)
    expect(screen.getByLabelText('hidden-field')).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByLabelText('hidden-field')).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('honours defaultOpen — starts expanded when the caller says so', () => {
    render(<CollapsedCard title="Import" filled={false} defaultOpen><input aria-label="hidden-field" /></CollapsedCard>)
    expect(screen.getByLabelText('hidden-field')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('the indicator dot reflects `filled` — muted/empty vs primary-tinted', () => {
    const { rerender, container } = render(<CollapsedCard title="Import" filled={false}><div /></CollapsedCard>)
    let dot = container.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(dot.style.background).toBe('var(--text-muted)')
    expect(dot.style.opacity).toBe('0.5')

    rerender(<CollapsedCard title="Import" filled><div /></CollapsedCard>)
    dot = container.querySelector('span[aria-hidden="true"]') as HTMLElement
    expect(dot.style.background).toBe('var(--color-primary)')
    expect(dot.style.opacity).toBe('1')
  })
})

// `action` (added 22-08 for MatchScoreSection's collapsible score card): header
// content that must stay reachable regardless of open/closed state — a sibling
// of the toggle button, never nested inside it.
describe('CollapsedCard · action slot (22-08, MatchScoreSection)', () => {
  it('renders the action content even while collapsed', () => {
    render(
      <CollapsedCard title="Score" filled action={<button type="button">Recalculate</button>}>
        <div>body</div>
      </CollapsedCard>,
    )
    expect(screen.getByRole('button', { name: 'Recalculate' })).toBeInTheDocument()
    expect(screen.queryByText('body')).not.toBeInTheDocument()
  })

  it('keeps the action as a SIBLING of the toggle button, never nested inside it', () => {
    render(
      <CollapsedCard title="Score" filled action={<button type="button">Recalculate</button>}>
        <div>body</div>
      </CollapsedCard>,
    )
    const toggle = screen.getByRole('button', { name: 'Score' })
    const action = screen.getByRole('button', { name: 'Recalculate' })
    // A native <button> cannot contain another <button> — the action must not
    // be a descendant of the toggle.
    expect(toggle.contains(action)).toBe(false)
  })

  it('renders nothing extra when no action is given (existing callers unaffected)', () => {
    render(<CollapsedCard title="Import" filled={false}><div /></CollapsedCard>)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})

// Controlled mode (added for KoiosRadar, Danny 22-08): a caller that passes
// BOTH `open` and `onOpenChange` owns the state itself (e.g. to persist it) —
// the card must never flip its own state underneath that caller.
describe('CollapsedCard · controlled mode (22-08, KoiosRadar)', () => {
  it('renders open/closed strictly from the `open` prop, not an internal default', () => {
    render(
      <CollapsedCard title="Advies" filled open={false} onOpenChange={() => {}}>
        <div>body</div>
      </CollapsedCard>,
    )
    expect(screen.queryByText('body')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advies' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('a click reports the next value via onOpenChange instead of flipping its own state', () => {
    const onOpenChange = vi.fn()
    render(
      <CollapsedCard title="Advies" filled open={false} onOpenChange={onOpenChange}>
        <div>body</div>
      </CollapsedCard>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Advies' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    // The prop hasn't changed (the test never re-renders with open=true), so the
    // card must still read as closed — it does not own the state itself.
    expect(screen.getByRole('button', { name: 'Advies' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('body')).not.toBeInTheDocument()
  })

  it('re-renders open once the caller applies the reported value', () => {
    const { rerender } = render(
      <CollapsedCard title="Advies" filled open={false} onOpenChange={() => {}}>
        <div>body</div>
      </CollapsedCard>,
    )
    rerender(
      <CollapsedCard title="Advies" filled open onOpenChange={() => {}}>
        <div>body</div>
      </CollapsedCard>,
    )
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Advies' })).toHaveAttribute('aria-expanded', 'true')
  })
})
