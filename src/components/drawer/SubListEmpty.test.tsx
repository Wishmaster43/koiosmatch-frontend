/**
 * SubListEmpty — behaviour test: renders the given text with the shared
 * muted 12px empty-state styling.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubListEmpty from './SubListEmpty'

describe('SubListEmpty', () => {
  it('renders the given text', () => {
    render(<SubListEmpty text="No matches yet" />)
    expect(screen.getByText('No matches yet')).toBeInTheDocument()
  })

  it('applies the shared muted 12px empty-state style', () => {
    render(<SubListEmpty text="Empty" />)
    const el = screen.getByText('Empty')
    expect(el).toHaveStyle({ fontSize: '12px', color: 'var(--text-muted)' })
  })
})
