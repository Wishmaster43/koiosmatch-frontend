/**
 * DrawerAddButton — DRAWER-ADD-SHORT-1 (Danny 05-08): a drawer sub-tab's add
 * trigger may shorten its VISIBLE text to the shared "Nieuw" word while keeping
 * the caller's full label as the accessible name (title + aria-label) — so an
 * existing getByRole('button', { name: fullLabel }) query keeps matching. This
 * file covers the default (full) rendering plus the new `short` behaviour.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import DrawerAddButton from './DrawerAddButton'

// Real, ACTIVE-locale strings (never hardcoded) — mirrors BranchSection.test.tsx's cm() helper.
const cm = (key: string) => i18n.t(key, { ns: 'common' })

describe('DrawerAddButton · default (full label)', () => {
  it('renders the full label as both the visible text and the accessible name', () => {
    render(<DrawerAddButton onClick={() => {}} label="Nieuwe afdeling" />)
    expect(screen.getByText('Nieuwe afdeling')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nieuwe afdeling' })).toBeInTheDocument()
  })
})

describe('DrawerAddButton · short (DRAWER-ADD-SHORT-1)', () => {
  it('renders the shared "Nieuw" word visibly while the full label stays the accessible name', () => {
    render(<DrawerAddButton onClick={() => {}} label="Nieuwe afdeling" short />)
    // Visible text collapses to the shared short word — the full label no longer shows.
    expect(screen.getByText(cm('new'))).toBeInTheDocument()
    expect(screen.queryByText('Nieuwe afdeling')).not.toBeInTheDocument()
    // The accessible name (and hover title) still carry the FULL label, so any
    // existing getByRole('button', { name: fullLabel }) query keeps passing.
    const button = screen.getByRole('button', { name: 'Nieuwe afdeling' })
    expect(button).toHaveAttribute('title', 'Nieuwe afdeling')
  })

  it('never goes icon-only just because short is set — some text always stays visible', () => {
    render(<DrawerAddButton onClick={() => {}} label="Nieuwe afdeling" short />)
    expect(screen.getByText(cm('new')).textContent).not.toBe('')
  })
})
