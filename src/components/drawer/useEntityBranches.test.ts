/**
 * useEntityBranches — the shared branch-membership hook behind BranchSection
 * (§3A/§11: promoted from candidates' useCandidateBranches so customers/other
 * entities reuse it too). Covers the fetchOnMount hydration (customers have no
 * embedded branches field, unlike a candidate) and the BUG CLASS FIX contract:
 * a failed add/remove reverts ONLY the toggled branch chip (§13 — asserts the
 * exact request, never just that a callback fired), mirroring
 * useCandidateDrawerData.test.tsx's coverage of the candidate-side hook.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import '@/i18n'
import { useEntityBranches } from './useEntityBranches'
import type { EntityBranch } from './BranchSection'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
      post: vi.fn(() => Promise.resolve({})),
      delete: vi.fn(() => Promise.resolve({})),
    },
  }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const apiGet = api.get as unknown as ReturnType<typeof vi.fn>
const apiPost = api.post as unknown as ReturnType<typeof vi.fn>
const apiDelete = api.delete as unknown as ReturnType<typeof vi.fn>

const branchA: EntityBranch = { id: 'b1', name: 'Noord' }
const branchB: EntityBranch = { id: 'b2', name: 'Zuid' }
const options = [{ value: 'b1', label: 'Noord' }, { value: 'b2', label: 'Zuid' }]

beforeEach(() => vi.clearAllMocks())

describe('useEntityBranches · fetchOnMount hydration (customers)', () => {
  it('GETs /{prefix}/{id}/branches once and seeds membership from the response', async () => {
    apiGet.mockResolvedValue({ data: { data: [branchA] } })
    const { result } = renderHook(() => useEntityBranches({ prefix: 'customers', id: 'cust1', options, fetchOnMount: true }))
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/customers/cust1/branches'))
    await waitFor(() => expect(result.current.selectedIds).toEqual(['b1']))
  })

  it('never fetches when fetchOnMount is false (candidates keep their own embedded membership)', () => {
    renderHook(() => useEntityBranches({ prefix: 'customers', id: 'cust1', options, fetchOnMount: false, initialBranches: [branchB] }))
    expect(apiGet).not.toHaveBeenCalled()
  })
})

describe('useEntityBranches · toggle add', () => {
  it('POSTs { location_id } to /{prefix}/{id}/branches and keeps the chip on success', async () => {
    apiPost.mockResolvedValue({})
    const { result } = renderHook(() => useEntityBranches({ prefix: 'customers', id: 'cust1', options }))
    act(() => { result.current.toggle('b1') })
    expect(result.current.selectedIds).toEqual(['b1'])
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/customers/cust1/branches', { location_id: 'b1' }))
    expect(result.current.selectedIds).toEqual(['b1'])
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the chip and surfaces the server message when the add FAILS', async () => {
    apiPost.mockRejectedValue({ response: { data: { message: 'Vestiging bestaat niet meer' } } })
    const { result } = renderHook(() => useEntityBranches({ prefix: 'customers', id: 'cust1', options, initialBranches: [branchB] }))
    act(() => { result.current.toggle('b1') })
    expect(result.current.selectedIds).toEqual(['b2', 'b1']) // optimistic
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    // Back to exactly the pre-edit set — branchB (a parallel chip) untouched.
    expect(result.current.selectedIds).toEqual(['b2'])
    expect(notifyError).toHaveBeenCalledWith('Vestiging bestaat niet meer')
  })
})

describe('useEntityBranches · toggle remove', () => {
  it('DELETEs /{prefix}/{id}/branches/{branch} and keeps it removed on success', async () => {
    apiDelete.mockResolvedValue({})
    const { result } = renderHook(() => useEntityBranches({ prefix: 'customers', id: 'cust1', options, initialBranches: [branchA, branchB] }))
    act(() => { result.current.toggle('b1') })
    expect(result.current.selectedIds).toEqual(['b2'])
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/customers/cust1/branches/b1'))
    expect(result.current.selectedIds).toEqual(['b2'])
  })

  it('puts the branch back and surfaces the server message when the remove FAILS', async () => {
    apiDelete.mockRejectedValue({ response: { data: { message: 'Verwijderen mislukt' } } })
    const { result } = renderHook(() => useEntityBranches({ prefix: 'customers', id: 'cust1', options, initialBranches: [branchA, branchB] }))
    act(() => { result.current.toggle('b1') })
    expect(result.current.selectedIds).toEqual(['b2'])
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect([...result.current.selectedIds].sort()).toEqual(['b1', 'b2'])
    expect(notifyError).toHaveBeenCalledWith('Verwijderen mislukt')
  })
})
