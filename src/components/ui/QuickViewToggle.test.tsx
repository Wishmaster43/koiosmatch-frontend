import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuickViewToggle from './QuickViewToggle'

// The one shared quick-view toggle (Blacklist/Archived/…) — guards the §4 soft-toggle behaviour
// so a page can never hand-roll a divergent one again (see the 5-style drift it replaced).
describe('QuickViewToggle', () => {
  it('renders the label and fires onToggle on click', () => {
    const onToggle = vi.fn()
    render(<QuickViewToggle active={false} onToggle={onToggle} label="Gearchiveerd" />)
    fireEvent.click(screen.getByRole('button', { name: 'Gearchiveerd' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('reflects the active state — aria-pressed + fontWeight 600 (inactive stays 500, never grey)', () => {
    const { rerender } = render(<QuickViewToggle active={false} onToggle={() => {}} label="Blacklist" />)
    let btn = screen.getByRole('button', { name: 'Blacklist' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn.style.fontWeight).toBe('500')

    rerender(<QuickViewToggle active onToggle={() => {}} label="Blacklist" />)
    btn = screen.getByRole('button', { name: 'Blacklist' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn.style.fontWeight).toBe('600')
  })

  // Text colour must be darkened toward readable --text; background/border keep the raw colour.
  it('darkens text colour for readability while background/border keep the raw colour', () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA: a deliberately hostile light-yellow test colour, not a UI colour choice
    render(<QuickViewToggle active onToggle={() => {}} label="Sick" color="#ffdd00" />)
    const btn = screen.getByRole('button', { name: 'Sick' })
    // chipInk: 45% blend toward --text — the old private 60% failed AA for
    // accent-yellow toggles (3.75:1, herhaal-slotaudit 20-08).
    // eslint-disable-next-line no-restricted-syntax -- DATA: asserting the exact chipInk output for that test colour
    expect(btn.style.color).toBe('color-mix(in srgb, #ffdd00 45%, var(--text))')
    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- DATA: asserting tintBg's exact output string, not hand-rolling the recipe
    expect(btn.style.background).toBe('color-mix(in srgb, rgb(255, 221, 0) 16%, transparent)')
    expect(btn.style.border).toContain('color-mix(in srgb, rgb(255, 221, 0)')
  })

  // HUISSTIJL-1 (PRIMAIR-VLAK-1): the plain-accent case (no explicit `color`) now
  // reads the house trio — solid fill while ON, calm surface+border while OFF —
  // instead of the §4 soft-tint formula every other coloured toggle still uses.
  it('reads the house trio for the default primary colour: calm off, solid trio on', () => {
    const { rerender } = render(<QuickViewToggle active={false} onToggle={() => {}} label="Default" />)
    let btn = screen.getByRole('button', { name: 'Default' })
    expect(btn.style.color).toBe('var(--color-primary-text)')
    expect(btn.style.background).toBe('var(--surface)')
    expect(btn.style.border).toBe('1px solid var(--border)')

    rerender(<QuickViewToggle active onToggle={() => {}} label="Default" />)
    btn = screen.getByRole('button', { name: 'Default' })
    expect(btn.style.color).toBe('var(--button-ink)')
    expect(btn.style.background).toBe('var(--button-fill)')
    expect(btn.style.border).toBe('1px solid var(--button-border)')
  })
})
