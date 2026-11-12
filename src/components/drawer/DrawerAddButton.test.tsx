/**
 * DrawerAddButton — DRAWER-ADD-SHORT-1 (Danny 05-08): a drawer sub-tab's add
 * trigger may shorten its VISIBLE text to the shared "Nieuw" word while keeping
 * the caller's full label as the accessible name (title + aria-label) — so an
 * existing getByRole('button', { name: fullLabel }) query keeps matching. This
 * file covers the default (full) rendering plus the new `short` behaviour.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import DrawerAddButton from './DrawerAddButton'
import { BTN_H_SM } from '@/config/buttonMetrics'

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

describe('DrawerAddButton · Button sm metrics (DRAWERADDBUTTON-SIZE-1)', () => {
  it('renders at the sm height and 12px text, with the plus icon, label, click and disabled', () => {
    const onClick = vi.fn()
    const { container, rerender } = render(<DrawerAddButton onClick={onClick} label="Nieuwe afdeling" />)
    const btn = screen.getByRole('button', { name: 'Nieuwe afdeling' })
    // Height comes from the shared constant, text is the Button sm 12px.
    expect(btn.style.height).toBe(`${BTN_H_SM}px`)
    expect(btn.style.fontSize).toBe('12px')
    expect(container.querySelector('svg')).not.toBeNull()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<DrawerAddButton onClick={onClick} label="Nieuwe afdeling" disabled />)
    expect(screen.getByRole('button', { name: 'Nieuwe afdeling' })).toBeDisabled()
  })
})
