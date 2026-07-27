/**
 * useCandidateBranches.toggle — BUG CLASS FIX regression coverage. A failed
 * add/remove used to only toast while the chip stayed in the state the server
 * rejected. These assert the SEAM (§13): the exact request, and that a FAILED
 * request puts the exact branch chip back (never the whole list, so a parallel
 * chip is never clobbered) while a resolved one keeps the new membership.
 * (useCandidateActivity/useBranchLocationOptions are plain read-only GETs with
 * no optimistic write, so they carry no instance of this bug — untouched here.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCandidateBranches } from './useCandidateDrawerData'
import type { Candidate, CandidateBranch } from '@/types/candidate'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      // /locations branch options — empty is fine, not what's under test here.
      get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
      post: vi.fn(() => Promise.resolve({})),
      delete: vi.fn(() => Promise.resolve({})),
    },
  }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const apiPost = api.post as unknown as ReturnType<typeof vi.fn>
const apiDelete = api.delete as unknown as ReturnType<typeof vi.fn>

const branchA: CandidateBranch = { id: 'b1', name: 'Noord' }
const branchB: CandidateBranch = { id: 'b2', name: 'Zuid' }
const candidateWith = (branches: CandidateBranch[]): Candidate => ({ id: 'c1', branches } as unknown as Candidate)

// useBranchLocationOptions (called internally) is react-query based — needs a client.
function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCandidateBranches · toggle add', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs the location id and keeps the chip when the request resolves', async () => {
    apiPost.mockResolvedValue({})
    const { result } = renderHook(() => useCandidateBranches(candidateWith([])), { wrapper })
    act(() => { result.current.toggle('b1') })
    expect(result.current.selectedIds).toEqual(['b1'])
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/candidates/c1/branches', { location_id: 'b1' }))
    expect(result.current.selectedIds).toEqual(['b1'])
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the chip and surfaces the server message when the add FAILS', async () => {
    apiPost.mockRejectedValue({ response: { data: { message: 'Vestiging bestaat niet meer' } } })
    const { result } = renderHook(() => useCandidateBranches(candidateWith([branchB])), { wrapper })
    act(() => { result.current.toggle('b1') })
    expect(result.current.selectedIds).toEqual(['b2', 'b1']) // optimistic
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    // Back to exactly the pre-edit set — branchB (a parallel chip) untouched.
    expect(result.current.selectedIds).toEqual(['b2'])
    expect(notifyError).toHaveBeenCalledWith('Vestiging bestaat niet meer')
  })
})

describe('useCandidateBranches · toggle remove', () => {
  beforeEach(() => vi.clearAllMocks())

  it('DELETEs the location id and keeps it removed when the request resolves', async () => {
    apiDelete.mockResolvedValue({})
    const { result } = renderHook(() => useCandidateBranches(candidateWith([branchA, branchB])), { wrapper })
    act(() => { result.current.toggle('b1') })
    expect(result.current.selectedIds).toEqual(['b2'])
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/candidates/c1/branches/b1'))
    expect(result.current.selectedIds).toEqual(['b2'])
  })

  it('puts the branch back and surfaces the server message when the remove FAILS', async () => {
    apiDelete.mockRejectedValue({ response: { data: { message: 'Verwijderen mislukt' } } })
    const { result } = renderHook(() => useCandidateBranches(candidateWith([branchA, branchB])), { wrapper })
    act(() => { result.current.toggle('b1') })
    expect(result.current.selectedIds).toEqual(['b2'])
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect([...result.current.selectedIds].sort()).toEqual(['b1', 'b2'])
    expect(notifyError).toHaveBeenCalledWith('Verwijderen mislukt')
  })
})
