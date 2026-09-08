/**
 * SaveButton — contract for the saved-state collision the Opus round-2 review
 * caught (20-08): the NORMAL post-save state is saved AND disabled (the form is
 * clean again), and that state must paint the §4 success pair, not Button's
 * grey disabled recipe. Saved is feedback, not inertness.
 *
 * When no children are passed, renders the house face with three states:
 * saved → "Opgeslagen", saving → "Opslaan…", else → "Opslaan".
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@/i18n' // Initialize i18n for the component
import SaveButton from './SaveButton'

describe('SaveButton', () => {
  it('saved + disabled (the real confirmation window) paints the success pair and blocks the click', () => {
    const onClick = vi.fn()
    render(<SaveButton saved disabled onClick={onClick}>Opgeslagen</SaveButton>)
    const b = screen.getByRole('button', { name: 'Opgeslagen' })
    expect(b.style.background).toBe('var(--color-success-bg)')
    expect(b.style.color).toBe('var(--color-on-success-bg)')
    expect(b.style.border).toBe('1px solid var(--color-success)')
    expect(b).toHaveAttribute('aria-disabled', 'true')
    expect(b).not.toBeDisabled()
    fireEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('saved without disabled keeps the pair and the click', () => {
    const onClick = vi.fn()
    render(<SaveButton saved onClick={onClick}>Opslaan</SaveButton>)
    const b = screen.getByRole('button')
    expect(b.style.background).toBe('var(--color-success-bg)')
    fireEvent.click(b)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('not saved passes disabled straight to Button (grey recipe)', () => {
    render(<SaveButton disabled>Opslaan</SaveButton>)
    const b = screen.getByRole('button')
    expect(b).toBeDisabled()
    expect(b.style.background).toBe('var(--border)')
  })

  it('house face when saving: renders Spinner + "Opslaan…"', () => {
    const onClick = vi.fn()
    render(<SaveButton saving onClick={onClick} />)
    const b = screen.getByRole('button', { name: /Opslaan/ })
    expect(b).toHaveTextContent('Opslaan')
    fireEvent.click(b)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('house face when saved: renders Check + "Opgeslagen" with success colours', () => {
    const onClick = vi.fn()
    render(<SaveButton saved disabled onClick={onClick} />)
    const b = screen.getByRole('button', { name: /Opgeslagen/ })
    expect(b).toHaveTextContent('Opgeslagen')
    expect(b.style.background).toBe('var(--color-success-bg)')
    expect(b.style.color).toBe('var(--color-on-success-bg)')
  })

  it('house face default state: renders Save + "Opslaan"', () => {
    const onClick = vi.fn()
    render(<SaveButton onClick={onClick} />)
    const b = screen.getByRole('button', { name: /Opslaan/ })
    expect(b).toHaveTextContent('Opslaan')
    fireEvent.click(b)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('explicit children always win over house face', () => {
    render(<SaveButton saving>Custom label</SaveButton>)
    const b = screen.getByRole('button', { name: 'Custom label' })
    expect(b).toHaveTextContent('Custom label')
  })
})
