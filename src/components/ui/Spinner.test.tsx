/**
 * Spinner — the a11y contract all 87 call-sites depend on (Opus E1 follow-up):
 * decorative by default (hidden from the tree), and ONLY with a label does it
 * become an announced status element.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Spinner from './Spinner'

describe('Spinner', () => {
  it('is decorative by default: aria-hidden, no role, invisible to the a11y tree', () => {
    const { container } = render(<Spinner />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('with a label it becomes an announced status element carrying that name', () => {
    render(<Spinner label="Bezig met laden" />)
    const el = screen.getByRole('status', { name: 'Bezig met laden' })
    expect(el).not.toHaveAttribute('aria-hidden')
  })

  it('spins via the shared class and follows the given size', () => {
    const { container } = render(<Spinner size={22} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('class')).toContain('animate-spin')
    expect(svg).toHaveAttribute('width', '22')
  })
})
