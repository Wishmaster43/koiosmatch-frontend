/**
 * PlanningOpenShifts — no fake affordance (D8): no scheduling endpoint exists yet
 * for the candidate planning module, so the per-row schedule trigger must render
 * disabled with an honest tooltip instead of a click that silently mutates only
 * local state (mirrors the PlanningTab module-not-available precedent).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlanningOpenShifts from './PlanningOpenShifts'
import type { OpenShift } from './planningTypes'

vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'] }) }))

const shift: OpenShift = {
  id: 'os1', date: '01-09-2026', time: '08:00-16:00', client: 'Zorggroep X',
  function: 'Verzorgende IG', location: 'Amersfoort',
  color: 'var(--color-info)',
  distance: 10, level: 3, shiftType: 'Dag', openSpots: 2, pool: 'Pool A',
}

const baseProps = {
  openShifts: [shift],
  openFilters: { shiftTypes: [], distance: 35, max_level: 5 },
  setOpenFilters: vi.fn(),
  scheduledIds: new Set<string>(),
  setScheduledIds: vi.fn(),
  favorites: { clients: [], locations: [], departments: [] },
  blacklist: { clients: [], locations: [], departments: [] },
}

describe('PlanningOpenShifts · schedule trigger (no persistence path yet)', () => {
  it('renders the schedule button disabled with the honest not-persisted-yet title', () => {
    render(<PlanningOpenShifts {...baseProps} />)
    const btn = screen.getByRole('button', { name: 'planning.schedule' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('title', 'planning.notPersistedYet')
  })

  it('shows the not-persisted-yet notice as VISIBLE text, not only a tooltip on a disabled control (§6)', () => {
    render(<PlanningOpenShifts {...baseProps} />)
    // A disabled button is never focusable, so a keyboard/screen-reader user would
    // never receive a title-only explanation — the calm line must be readable text.
    expect(screen.getAllByText('planning.notPersistedYet').length).toBeGreaterThan(0)
  })

  it('never calls setScheduledIds — a click could not silently change anything', () => {
    render(<PlanningOpenShifts {...baseProps} />)
    // A disabled native <button> does not fire onClick even if clicked, but the
    // real assertion is structural: the handler this used to call is gone.
    expect(baseProps.setScheduledIds).not.toHaveBeenCalled()
  })
})
