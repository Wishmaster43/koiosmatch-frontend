/**
 * VacancyBranchBlock — Danny 21-08 "Zoals kandidaat en klant": the chips +
 * "+ Vestiging" look via the shared BranchSection, with single-value semantics.
 * §13: every mutation asserts the update body, never only that a callback fired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VacancyBranchBlock from './VacancyBranchBlock'
import type { VacancyDetail } from '@/types/vacancy'

vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [
    { value: 'branch-1', label: 'Hoofdkantoor Assen' },
    { value: 'branch-2', label: 'Vestiging Zuid' },
  ],
}))

const vacancy = (over: Partial<VacancyDetail> = {}) =>
  ({ id: 'v1', branchId: '', branchName: '', ...over }) as VacancyDetail

describe('VacancyBranchBlock (chips-look, single-value)', () => {
  const onUpdate = vi.fn()
  beforeEach(() => onUpdate.mockClear())

  it('shows the empty state and picks a branch through the "+" picker — persists immediately', async () => {
    const user = userEvent.setup()
    render(<VacancyBranchBlock vacancy={vacancy()} onUpdate={onUpdate} />)
    expect(screen.getByText('candidates:sections.branchEmpty')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'candidates:sections.branchLink' }))
    await user.click(await screen.findByText('Hoofdkantoor Assen'))
    expect(onUpdate).toHaveBeenCalledWith('v1', { branchId: 'branch-1', branchName: 'Hoofdkantoor Assen' })
  })

  it('renders the linked branch as a chip; the chip × clears for real (VAC-CLEAR-1)', async () => {
    const user = userEvent.setup()
    render(<VacancyBranchBlock vacancy={vacancy({ branchId: 'branch-2', branchName: 'Vestiging Zuid' })} onUpdate={onUpdate} />)
    expect(screen.getByText('Vestiging Zuid')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'remove' }))
    expect(onUpdate).toHaveBeenCalledWith('v1', { branchId: null, branchName: '' })
  })

  it('picking ANOTHER branch replaces the current one (single-value semantics)', async () => {
    const user = userEvent.setup()
    render(<VacancyBranchBlock vacancy={vacancy({ branchId: 'branch-2', branchName: 'Vestiging Zuid' })} onUpdate={onUpdate} />)
    await user.click(screen.getByRole('button', { name: 'candidates:sections.branchLink' }))
    await user.click(await screen.findByText('Hoofdkantoor Assen'))
    expect(onUpdate).toHaveBeenCalledWith('v1', { branchId: 'branch-1', branchName: 'Hoofdkantoor Assen' })
  })
})
