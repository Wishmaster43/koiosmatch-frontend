/**
 * PlanningTab — audit R1 regression: this tab's fields (roles/pools/shift-type/
 * driving-licences/info) have no backend save path at all (no PATCH/PUT writes
 * `candidate_planning_settings`, only a read-side resource exists) — a recruiter
 * editing them used to silently lose the change on close. This now gates the
 * whole tab read-only (every control disabled) with one calm notice, instead of
 * inventing an endpoint. Covers: the notice renders, and every interactive
 * control is disabled.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PlanningTab from './PlanningTab'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG', 'Verpleegkundige'] }) }))
vi.mock('@/lib/usePools', () => ({ usePools: () => ({ pools: ['Pool Noord', 'Pool Zuid'] }) }))
vi.mock('@/lib/useDriverLicenses', () => ({ useDriverLicenses: () => ({ licenses: ['B', 'BE'] }) }))

const candidate = (planningSettings?: Record<string, unknown>): Candidate =>
  ({ id: 'cand-1', planningSettings } as unknown as Candidate)

describe('PlanningTab · not-yet-persisted gate (CMFE audit R1)', () => {
  it('shows the calm notice explaining nothing here saves yet', () => {
    render(<PlanningTab c={candidate()} />)
    expect(screen.getByText('planning.notPersistedYet')).toBeInTheDocument()
  })

  it('disables every role/pool/shift-type chip', () => {
    render(<PlanningTab c={candidate({ roles: ['Verzorgende IG'], pools: ['Pool Noord'] })} />)
    expect(screen.getByRole('button', { name: 'Verzorgende IG' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Pool Noord' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Pool Zuid' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'planning.eveningShift' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'planning.dayShift' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'planning.nightShift' })).toBeDisabled()
  })

  it('disables the roles/pools "all/none" shortcut buttons', () => {
    render(<PlanningTab c={candidate()} />)
    // One "common:all" shortcut for roles, one for pools — both must be disabled.
    const shortcuts = screen.getAllByRole('button', { name: 'common:all' })
    expect(shortcuts).toHaveLength(2)
    shortcuts.forEach(btn => expect(btn).toBeDisabled())
  })

  it('disables the planning-info text input', () => {
    render(<PlanningTab c={candidate({ info: 'Alleen dagdienst' })} />)
    const input = screen.getByLabelText('planning.planningInfo') as HTMLInputElement
    expect(input).toBeDisabled()
    expect(input.value).toBe('Alleen dagdienst')
  })

  it('disables the "add driving licence" trigger and any already-selected licence chip', () => {
    render(<PlanningTab c={candidate({ drivingLicences: ['B'] })} />)
    expect(screen.getByRole('button', { name: /planning.addLicense/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'common:close' })).toBeDisabled()
  })
})
