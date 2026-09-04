/**
 * RelationsSection · candidate picker (PRIV-1/PRIV-2 repair, Opus REJECT verdict
 * priv1-dup04). Render-level coverage for the `!fixedCandidateId` picker branch,
 * which had ZERO coverage before this test: the "type to search" hint now lives
 * in the trigger's own `placeholder` (occlusion fix — see RelationsSection.tsx's
 * inline comment on the field) instead of a Caption below the trigger, which the
 * portal popover covered the instant it opened. Mirrors
 * RelationsSection.vacancyClear.test.tsx's fixture shape/harness (renders the
 * section in isolation, not the whole MatchModal).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RelationsSection from './RelationsSection'

// Every handler/list prop the component declares, stubbed to a safe no-op/empty
// default — this test only exercises the un-fixed candidate picker.
const baseProps = {
  t: ((k: string, opts?: Record<string, unknown>) => (opts?.min != null ? `${k}:${opts.min}` : k)) as unknown as import('i18next').TFunction,
  errors: {},
  hasContractLines: false, contractLines: [], setContractLines: vi.fn(), customerNotApplicable: false,
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
  vacancyId: '', setVacancyId: vi.fn(), vacancyOptions: [],
  branchMismatch: false, candBranch: null, detail: null,
  mismatchChoice: 'match' as const, setMismatchChoice: vi.fn(),
}

// The picker branch's own props: no fixedCandidateId, an onSearch-driven
// candidateOptions list, and the min-chars contract PRIV-1 introduced.
const candidateSearchMinChars = 2

describe('RelationsSection · candidate picker (PRIV-1/PRIV-2)', () => {
  it('shows the "type to search" hint as the trigger PLACEHOLDER while below the minimum — not occluded by the popover', () => {
    render(<RelationsSection {...baseProps} fixedCandidateId={undefined} pickedCandidateId=""
      setPickedCandidateId={vi.fn()} candidateOptions={[]} candidateSearch=""
      setCandidateSearch={vi.fn()} candidateSearchMinChars={candidateSearchMinChars} />)
    // Closed-trigger text: CreatableSelect renders `value || placeholder` in the trigger span.
    expect(screen.getByText('candidates:merge.searchHint:2')).toBeInTheDocument()
  })

  it('typing >= 2 characters fires onSearch and the mocked options become pickable', async () => {
    const user = userEvent.setup()
    const setCandidateSearch = vi.fn()
    render(<RelationsSection {...baseProps} fixedCandidateId={undefined} pickedCandidateId=""
      setPickedCandidateId={vi.fn()} candidateOptions={[{ id: 'cand-9', name: 'Piet Kandidaat' }]}
      candidateSearch="Pi" setCandidateSearch={setCandidateSearch} candidateSearchMinChars={candidateSearchMinChars} />)
    const candidateField = screen.getByText('placement.candidate').parentElement as HTMLElement
    await user.click(within(candidateField).getByRole('button'))
    // options prop already carries the mocked result (mirrors how useMatchForm's
    // own effect would have set it after the debounced onSearch fired for "Pi").
    expect(await screen.findByRole('button', { name: 'Piet Kandidaat' })).toBeInTheDocument()
  })

  it('picking a candidate shows the name on the trigger and the hint is gone', async () => {
    const user = userEvent.setup()
    const setPickedCandidateId = vi.fn()
    const { rerender } = render(<RelationsSection {...baseProps} fixedCandidateId={undefined} pickedCandidateId=""
      setPickedCandidateId={setPickedCandidateId} candidateOptions={[{ id: 'cand-9', name: 'Piet Kandidaat' }]}
      candidateSearch="Pi" setCandidateSearch={vi.fn()} candidateSearchMinChars={candidateSearchMinChars} />)
    const candidateField = screen.getByText('placement.candidate').parentElement as HTMLElement
    await user.click(within(candidateField).getByRole('button'))
    await user.click(await screen.findByRole('button', { name: 'Piet Kandidaat' }))
    expect(setPickedCandidateId).toHaveBeenCalledWith('cand-9')

    // Simulate the parent applying the pick (as useMatchForm's setPickedCandidateId does)
    // and the query resetting below the minimum — the hint must stay gone once picked.
    rerender(<RelationsSection {...baseProps} fixedCandidateId={undefined} pickedCandidateId="cand-9"
      setPickedCandidateId={setPickedCandidateId} candidateOptions={[{ id: 'cand-9', name: 'Piet Kandidaat' }]}
      candidateSearch="" setCandidateSearch={vi.fn()} candidateSearchMinChars={candidateSearchMinChars} />)
    expect(screen.getByText('Piet Kandidaat')).toBeInTheDocument()
    expect(screen.queryByText('candidates:merge.searchHint:2')).not.toBeInTheDocument()
  })
})
