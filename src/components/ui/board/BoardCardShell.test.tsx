/**
 * BoardCardShell — keyboard-operable draggable card wrapper (DRY round 11, PAGES).
 * Asserts the accessible name/role, that Enter activates it, and that a native
 * dragstart still reaches the caller's own onDragStart handler.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoardCardShell from './BoardCardShell'

describe('BoardCardShell', () => {
  it('names the card via ariaLabel and activates onClick on Enter (keyboard operability)', async () => {
    const onClick = vi.fn()
    render(
      <BoardCardShell onDragStart={vi.fn()} onClick={onClick} selected={false} ariaLabel="Jane Doe · Vacancy">
        <span>card body</span>
      </BoardCardShell>,
    )
    const card = screen.getByRole('button', { name: 'Jane Doe · Vacancy' })
    expect(card).toHaveAttribute('tabindex', '0')
    card.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('forwards a native dragstart to the caller onDragStart handler', () => {
    const onDragStart = vi.fn()
    render(
      <BoardCardShell onDragStart={onDragStart} onClick={vi.fn()} selected={false} ariaLabel="card">
        <span>card body</span>
      </BoardCardShell>,
    )
    const card = screen.getByRole('button', { name: 'card' })
    card.dispatchEvent(Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer: {} }))
    expect(onDragStart).toHaveBeenCalledTimes(1)
  })

  it('highlights the selected border in the primary colour', () => {
    render(
      <BoardCardShell onDragStart={vi.fn()} onClick={vi.fn()} selected ariaLabel="card">
        <span>card body</span>
      </BoardCardShell>,
    )
    const card = screen.getByRole('button', { name: 'card' })
    expect(card.getAttribute('style')).toContain('border: 1px solid var(--color-primary)')
  })
})
