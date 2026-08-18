/**
 * Button — the house button's contract (HUISSTIJL-1). What is pinned here is the
 * part that must never drift: every colour is a token (tenant theming depends on
 * it), the three de-facto variants keep their identity, disabled drops the claim
 * to attention, and type defaults to "button" (the native submit default has
 * caused real bugs in modals with forms).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Button from './Button'
import { BTN_H } from '@/config/buttonMetrics'

describe('Button', () => {
  it('renders a real button with type=button by default (never an implicit submit)', () => {
    render(<Button>Opslaan</Button>)
    expect(screen.getByRole('button', { name: 'Opslaan' })).toHaveAttribute('type', 'button')
  })

  it('primary paints the accent pair — token only, never a literal colour', () => {
    render(<Button variant="primary">Ga</Button>)
    const b = screen.getByRole('button')
    expect(b.style.background).toBe('var(--color-primary)')
    expect(b.style.color).toBe('var(--color-on-accent)')
  })

  it('secondary is the calm surface + border pair at the shared height', () => {
    render(<Button variant="secondary">Annuleren</Button>)
    const b = screen.getByRole('button')
    expect(b.style.background).toBe('var(--surface)')
    expect(b.style.border).toBe('1px solid var(--border)')
    expect(b.style.height).toBe(`${BTN_H}px`)
  })

  it('danger uses the fixed danger pair, not the tenant accent', () => {
    render(<Button variant="danger">Verwijderen</Button>)
    const b = screen.getByRole('button')
    expect(b.style.background).toBe('var(--color-danger)')
    expect(b.style.color).toBe('var(--color-on-danger)')
  })

  it('disabled drops the fill and blocks the click', () => {
    const onClick = vi.fn()
    render(<Button variant="primary" disabled onClick={onClick}>Ga</Button>)
    const b = screen.getByRole('button')
    expect(b).toBeDisabled()
    fireEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
    expect(b.style.background).toBe('var(--border)')
  })

  it('never contains a hardcoded hex or white in its own inline style', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'soft', 'danger', 'dangerSoft'] as const) {
      const { unmount } = render(<Button variant={variant}>x</Button>)
      const style = screen.getByRole('button').getAttribute('style') ?? ''
      // `: white` as a VALUE — `white-space: nowrap` is a property name and fine.
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|:\s*white\b/)
      unmount()
    }
  })

  it('caller style may add layout but the variant sets the identity', () => {
    render(<Button variant="primary" style={{ width: '100%' }}>Ga</Button>)
    const b = screen.getByRole('button')
    expect(b.style.width).toBe('100%')
    expect(b.style.background).toBe('var(--color-primary)')
  })
})
