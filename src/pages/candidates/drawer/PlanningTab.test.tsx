/**
 * PlanningTab — fake-affordance sweep (14-08): the previous version rendered a
 * whole screen of roles/pools/shift-type/driving-licence pickers, all permanently
 * disabled because no PATCH/PUT endpoint writes `candidate_planning_settings`
 * (audit R1, 2026-07-17). A screen full of dead greyed-out controls is a worse
 * signal than a plain notice, so this now renders ONE calm empty state instead.
 * Covers: the notice renders, and none of the old dead controls exist in the DOM.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlanningTab from './PlanningTab'


describe('PlanningTab · module-not-available notice', () => {
  it('shows the calm notice that the planning module is not available yet', () => {
    render(<PlanningTab />)
    expect(screen.getByText('planning.moduleNotAvailableTitle')).toBeInTheDocument()
    expect(screen.getByText('planning.moduleNotAvailableBody')).toBeInTheDocument()
  })

  it('renders no dead roles/pools/shift-type/licence controls', () => {
    render(<PlanningTab />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
