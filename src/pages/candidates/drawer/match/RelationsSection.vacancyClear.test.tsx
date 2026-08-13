/**
 * RelationsSection · vacancy clear (point 1.8.4, Danny's ten-point round: "een
 * misklik moet herstelbaar zijn"). Verifies the vacancy picker uses the shared
 * `CreatableSelect`'s own opt-in `clearable` X (VAC-CLEAR-1) — CLAUDE.md §11:
 * reuse, never a hand-rolled button — and that it calls `setVacancyId('')`,
 * exactly like a fresh pick would call it with a real id. Renders the section in
 * isolation (not the whole MatchModal) — a lighter, targeted harness for one
 * small affordance; the REVERT logic itself (which fields actually get blanked)
 * is covered at the hook level in useMatchForm.vacancyPrefill.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RelationsSection from './RelationsSection'

// Every handler/list prop the component declares, stubbed to a safe no-op/empty
// default — this test only exercises the vacancy field's own clear affordance.
const baseProps = {
  t: ((k: string) => k) as unknown as import('i18next').TFunction,
  errors: {},
  fixedCandidateId: 'cand-1', pickedCandidateId: '', setPickedCandidateId: vi.fn(),
  candidateOptions: [],
  customerId: '', setCustomerId: vi.fn(), customerOptions: [],
  locationId: '', setLocationId: vi.fn(), locations: [],
  departmentId: '', setDepartmentId: vi.fn(), departments: [],
  contactId: '', setContactId: vi.fn(), contacts: [],
  creatingContact: false, setCreatingContact: vi.fn(), nc: { first_name: '', last_name: '', email: '', phone: '', mobile: '', function: '' }, setNc: vi.fn(), saveContact: vi.fn(),
  duplicateContact: null, setDuplicateContact: vi.fn(),
  contactFunctions: [], contactFunctionsAllowFreeEntry: false,
  func: '', setFunc: vi.fn(), functions: [],
  ownerId: '', setOwnerId: vi.fn(), users: [],
  branchId: '', setBranchId: vi.fn(), setBranchDirty: vi.fn(), branchLocations: [],
  vacancyOptions: [{ value: 'vac-1', label: 'Verzorgende IG', client: 'Zorggroep A' }],
  branchMismatch: false, candBranch: null, detail: null,
  mismatchChoice: 'match' as const, setMismatchChoice: vi.fn(),
}

describe('RelationsSection · vacancy clear (point 1.8.4)', () => {
  it('shows no clear affordance while no vacancy is picked', () => {
    render(<RelationsSection {...baseProps} vacancyId="" setVacancyId={vi.fn()} />)
    // CreatableSelect's clearable X only renders once a value is actually set (VAC-CLEAR-1).
    expect(screen.queryByRole('button', { name: 'clearField' })).toBeNull()
  })

  it('clicking the ✕ calls setVacancyId with the empty value — a misklik is recoverable', async () => {
    const user = userEvent.setup()
    const setVacancyId = vi.fn()
    render(<RelationsSection {...baseProps} vacancyId="vac-1" setVacancyId={setVacancyId} />)
    await user.click(screen.getByRole('button', { name: 'clearField' }))
    expect(setVacancyId).toHaveBeenCalledWith('')
  })

  it('picking a DIFFERENT vacancy from the dropdown funnels through the SAME setVacancyId as the clear', async () => {
    const user = userEvent.setup()
    const setVacancyId = vi.fn()
    render(<RelationsSection {...baseProps} vacancyId="" setVacancyId={setVacancyId} />)
    await user.click(screen.getByRole('button', { name: /placement\.noVacancy$/ }))
    await user.click(await screen.findByRole('button', { name: /Verzorgende IG/ }))
    expect(setVacancyId).toHaveBeenCalledWith('vac-1')
  })
})
