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
// ONIX D-003: default unrestricted (no branch_ids) — the per-test override below narrows it.
const authUser = vi.hoisted(() => ({ current: {} as { branch_ids?: Array<string | number> } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: authUser.current }) }))

const vacancy = (over: Partial<VacancyDetail> = {}) =>
  ({ id: 'v1', branchId: '', branchName: '', ...over }) as VacancyDetail

describe('VacancyBranchBlock (chips-look, single-value)', () => {
  const onUpdate = vi.fn()
  beforeEach(() => { onUpdate.mockClear(); authUser.current = {} })

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

  // ONIX D-003: a branch-restricted user's "+" picker only offers the branches they hold.
  it('narrows the "+" picker to the user own branch grants', async () => {
    authUser.current = { branch_ids: ['branch-2'] }
    const user = userEvent.setup()
    render(<VacancyBranchBlock vacancy={vacancy()} onUpdate={onUpdate} />)
    await user.click(screen.getByRole('button', { name: 'candidates:sections.branchLink' }))
    expect(await screen.findByText('Vestiging Zuid')).toBeInTheDocument()
    expect(screen.queryByText('Hoofdkantoor Assen')).not.toBeInTheDocument()
  })

  // The current chip stays visible even when the vacancy's branch sits outside the
  // user's own grants — the `branches` prop renders it independent of the options list.
  it('keeps the current chip visible even outside the user own branch grants', () => {
    authUser.current = { branch_ids: ['branch-2'] }
    render(<VacancyBranchBlock vacancy={vacancy({ branchId: 'branch-1', branchName: 'Hoofdkantoor Assen' })} onUpdate={onUpdate} />)
    expect(screen.getByText('Hoofdkantoor Assen')).toBeInTheDocument()
  })
})
