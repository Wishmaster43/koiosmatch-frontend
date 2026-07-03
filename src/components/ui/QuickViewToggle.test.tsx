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
})
