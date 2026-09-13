import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EntityDrawerCreatedAtFooter } from './EntityDrawerCreatedAtFooter'

// §3A(8): created-at left, empty right — same two-sided footer on every entity drawer.
describe('EntityDrawerCreatedAtFooter', () => {
  it('renders the created-at label', () => {
    render(<EntityDrawerCreatedAtFooter createdAtLabel="Created 12-07-2026" />)
    expect(screen.getByText('Created 12-07-2026')).toBeInTheDocument()
  })
})
