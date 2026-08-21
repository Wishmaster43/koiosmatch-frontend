/**
 * VacancyBranchBlock · DRILLDOWN-VOLGORDE-CANON (Danny 21-08, VACATURES 1/3):
 * the vacancy's own bureau branch (vestiging, location_id) as the drill-down's
 * LAST block — unlike the match drawer's read-only SharedBranchSection, this
 * one has a real PATCH path, so a pick or a clear must persist immediately
 * (no pencil). VAC-CLEAR-1 regression: picking then clearing must reach the
 * PATCH as `branchId: null`, never be silently swallowed.
 *
 * No i18n resources are loaded in this suite (the component's own import
 * chain never touches `src/i18n`), so `t()` echoes the raw key — the shared
 * CreatableSelect's clear button is likewise located by its own raw-key
 * fallback ('clearField'), the same convention CreatableSelect.test.tsx uses.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacancyBranchBlock from './VacancyBranchBlock'
import type { VacancyDetail } from '@/types/vacancy'

// The block reads its own useLocations() — stubbed here (no QueryClient in
// this suite, mirrors useVacancyDetailsForm.test.ts's own stub of the same hook).
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'branch-1', label: 'Hoofdkantoor Assen' }, { value: 'branch-2', label: 'Vestiging Zuid' }],
}))

const vacancy = { id: 'v1', branchId: '', branchName: '' } as unknown as VacancyDetail

describe('VacancyBranchBlock · picking a branch', () => {
  it('picking a branch persists immediately via onUpdate(id, { branchId, branchName })', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<VacancyBranchBlock vacancy={vacancy} onUpdate={onUpdate} />)
    await user.click(screen.getByRole('button', { name: 'common:select' }))
    await user.click(screen.getByRole('button', { name: 'Hoofdkantoor Assen' }))
    expect(onUpdate).toHaveBeenCalledWith('v1', { branchId: 'branch-1', branchName: 'Hoofdkantoor Assen' })
  })

  it('shows the currently picked branch as the trigger\'s value', () => {
    const withBranch = { ...vacancy, branchId: 'branch-2', branchName: 'Vestiging Zuid' } as VacancyDetail
    render(<VacancyBranchBlock vacancy={withBranch} onUpdate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Vestiging Zuid' })).toBeInTheDocument()
  })
})

// VAC-CLEAR-1 (Danny: "gekozen waarde weer leegmaken"): the field is optional,
// so clearing it must reach the PATCH as `branchId: null`, never be swallowed.
describe('VacancyBranchBlock · clearing a picked branch (VAC-CLEAR-1)', () => {
  it('the clear affordance only shows once a branch is picked', () => {
    render(<VacancyBranchBlock vacancy={vacancy} onUpdate={vi.fn()} />)
    // Nothing picked yet — no clear control, only the placeholder trigger.
    expect(screen.queryByRole('button', { name: 'clearField' })).not.toBeInTheDocument()
  })

  it('pick → clear: clearing a picked branch calls onUpdate with branchId: null, branchName: \'\'', async () => {
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    const withBranch = { ...vacancy, branchId: 'branch-1', branchName: 'Hoofdkantoor Assen' } as VacancyDetail
    render(<VacancyBranchBlock vacancy={withBranch} onUpdate={onUpdate} />)
    await user.click(screen.getByRole('button', { name: 'clearField' }))
    // `null`, never omitted — buildVacancyPatch gates on `'branchId' in patch`.
    expect(onUpdate).toHaveBeenCalledWith('v1', { branchId: null, branchName: '' })
  })

  it('a cleared vacancy (rerendered with the emptied prop) falls back to the placeholder', () => {
    const { rerender } = render(
      <VacancyBranchBlock vacancy={{ ...vacancy, branchId: 'branch-1', branchName: 'Hoofdkantoor Assen' } as VacancyDetail} onUpdate={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Hoofdkantoor Assen' })).toBeInTheDocument()
    // Mirrors what onUpdate's optimistic reconciliation feeds back onto `vacancy`.
    rerender(<VacancyBranchBlock vacancy={{ ...vacancy, branchId: '', branchName: '' } as VacancyDetail} onUpdate={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'common:select' })).toBeInTheDocument()
  })
})
