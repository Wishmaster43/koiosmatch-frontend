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

  it('primary paints the button trio — one token flip restyles every action button (PRIMAIR-VLAK-1)', () => {
    render(<Button variant="primary">Ga</Button>)
    const b = screen.getByRole('button')
    expect(b.style.background).toBe('var(--button-fill)')
    expect(b.style.color).toBe('var(--button-ink)')
  })

  it('secondary is the calm surface + border pair, defaulting to the sm standard height', () => {
    // Danny 19-08 ("drill downs moeten allemaal zelfde zijn"): the DEFAULT is 28;
    // md/BTN_H is the explicit page-toolbar exception, asserted separately below.
    render(<Button variant="secondary">Annuleren</Button>)
    const b = screen.getByRole('button')
    expect(b.style.background).toBe('var(--surface)')
    expect(b.style.border).toBe('1px solid var(--border)')
    expect(b.style.height).toBe('28px')
  })

  it('size="md" is the explicit toolbar exception at BTN_H', () => {
    render(<Button variant="primary" size="md">Nieuw</Button>)
    expect(screen.getByRole('button').style.height).toBe(`${BTN_H}px`)
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
    expect(b.style.background).toBe('var(--button-fill)')
  })

  // HUISSTIJL slotaudit V7 — a link that looks like a button stays a real <a>
  // (mailto/tel/download, §6) but shares this exact identity, so it never grows
  // its own inline-styled copy (ContactPersonDrawer's pseudo-buttons, V7).
  it('href renders a real link with the Button identity, keyboard focusable', () => {
    render(<Button variant="secondary" href="mailto:test@koiosmatch.nl">Mail</Button>)
    const link = screen.getByRole('link', { name: 'Mail' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'mailto:test@koiosmatch.nl')
    expect(link.style.background).toBe('var(--surface)')
    expect(link.style.height).toBe('28px')
    // A real <a href> is keyboard focusable by default — no tabIndex trickery needed.
    link.focus()
    expect(link).toHaveFocus()
  })

  it('href + target="_blank" gets the safe rel pair unless the caller overrides it', () => {
    render(<Button href="https://example.com" target="_blank">Extern</Button>)
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('a disabled href link drops href/tabIndex and blocks the click', () => {
    const onClick = vi.fn()
    render(<Button href="mailto:test@koiosmatch.nl" disabled onClick={onClick}>Mail</Button>)
    const link = screen.getByText('Mail')
    expect(link).not.toHaveAttribute('href')
    expect(link).toHaveAttribute('aria-disabled', 'true')
    expect(link).toHaveAttribute('tabindex', '-1')
    fireEvent.click(link)
    expect(onClick).not.toHaveBeenCalled()
  })

  // Opus slotaudit review, 20-08: InUseCountsDialog's archive tint spread AFTER the
  // disabled recipe and erased the only inert signal — the disabled identity must
  // win over whatever state styling the caller passes.
  it('the disabled recipe wins over a caller state tint', () => {
    render(<Button variant="primary" disabled style={{ background: 'var(--color-archived-bg)', color: 'var(--color-archived)' }}>Archiveren</Button>)
    const b = screen.getByRole('button')
    expect(b.style.background).toBe('var(--border)')
    expect(b.style.color).toBe('var(--text-muted)')
  })
})
