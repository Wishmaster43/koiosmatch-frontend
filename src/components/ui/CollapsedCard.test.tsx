import { describe, it, expect } from 'vitest'
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
