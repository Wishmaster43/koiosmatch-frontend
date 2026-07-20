import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from './ConfirmDialog'

// The one shared confirm modal (replaces window.confirm everywhere) — guards render,
// the confirm/cancel callbacks and the Escape-to-close focus-trap behaviour.
describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    render(<ConfirmDialog open={false} message="Weet je het zeker?" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the message (and optional title) while open', () => {
    render(<ConfirmDialog open title="Verwijderen" message="Weet je het zeker?" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Verwijderen')).toBeInTheDocument()
    expect(screen.getByText('Weet je het zeker?')).toBeInTheDocument()
  })

  it('fires onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog open message="Weet je het zeker?" onConfirm={onConfirm} onCancel={vi.fn()} confirmLabel="Verwijderen" />)
    fireEvent.click(screen.getByRole('button', { name: 'Verwijderen' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('fires onCancel when the cancel button is clicked', () => {
    // No i18n import here (mirrors ActionRuleDialog.test.tsx) — react-i18next falls
    // back to the raw key when no resources are loaded, so the default label is 'cancel'.
    const onCancel = vi.fn()
    render(<ConfirmDialog open message="Weet je het zeker?" onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape via the shared focus trap', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog open message="Weet je het zeker?" onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('applies the danger colour token when danger is set', () => {
    render(<ConfirmDialog open danger message="Verwijderen?" confirmLabel="Verwijderen" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Verwijderen' })
    expect(btn.style.background).toBe('var(--color-danger)')
  })
})
