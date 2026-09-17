/**
 * PlanningContactPill — unit test for the shared yes/no pill: active renders
 * the success tint with the message icon, inactive renders the muted dot.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlanningContactPill from './PlanningContactPill'

describe('PlanningContactPill', () => {
  it('renders the success tint and label when active', () => {
    render(<PlanningContactPill active label="Ja" />)
    const pill = screen.getByText('Ja').closest('span')
    expect(pill).toHaveStyle({ background: 'var(--color-success-bg)' })
  })

  it('renders the muted tint and label when inactive', () => {
    render(<PlanningContactPill active={false} label="Nee" />)
    const pill = screen.getByText('Nee').closest('span')
    expect(pill).toHaveStyle({ background: 'var(--hover-bg)' })
  })
})
