/**
 * useCandidatePools.toggle — BUG CLASS FIX regression coverage. A failed
 * add/remove used to only toast while the chip stayed in the state the server
 * rejected. These assert the SEAM (§13): the exact request, and that a FAILED
 * request puts the exact pool chip back (never the whole list, so a parallel
 * chip is never clobbered) while a resolved one keeps the new membership.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCandidatePools } from './useCandidatePools'
import type { Candidate, CandidatePool } from '@/types/candidate'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      // /pools tenant list — empty is fine, not what's under test here.
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

const poolA: CandidatePool = { id: 'p1', name: 'ICU' }
const poolB: CandidatePool = { id: 'p2', name: 'ER' }
const candidateWith = (pools: CandidatePool[]): Candidate => ({ id: 'c1', pools } as unknown as Candidate)

describe('useCandidatePools · toggle add', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs the pool id and keeps the chip when the request resolves', async () => {
    apiPost.mockResolvedValue({})
    const { result } = renderHook(() => useCandidatePools(candidateWith([])))
    act(() => { result.current.toggle(poolA) })
    expect(result.current.pools).toEqual([poolA]) // optimistic immediately
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/candidates/c1/pools', { pool_id: 'p1' }))
    expect(result.current.pools).toEqual([poolA])
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the chip and surfaces the server message when the add FAILS', async () => {
    apiPost.mockRejectedValue({ response: { data: { message: 'Pool bestaat niet meer' } } })
    const { result } = renderHook(() => useCandidatePools(candidateWith([poolB])))
    act(() => { result.current.toggle(poolA) })
    expect(result.current.pools).toEqual([poolB, poolA]) // optimistic
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    // Back to exactly the pre-edit set — poolB (a parallel chip) untouched.
    expect(result.current.pools).toEqual([poolB])
    expect(notifyError).toHaveBeenCalledWith('Pool bestaat niet meer')
  })
})

describe('useCandidatePools · toggle remove', () => {
  beforeEach(() => vi.clearAllMocks())

  it('DELETEs the pool id and keeps it removed when the request resolves', async () => {
    apiDelete.mockResolvedValue({})
    const { result } = renderHook(() => useCandidatePools(candidateWith([poolA, poolB])))
    act(() => { result.current.toggle(poolA) })
    expect(result.current.pools).toEqual([poolB])
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/candidates/c1/pools/p1'))
    expect(result.current.pools).toEqual([poolB])
  })

  it('puts the pool back and surfaces the server message when the remove FAILS', async () => {
    apiDelete.mockRejectedValue({ response: { data: { message: 'Verwijderen mislukt' } } })
    const { result } = renderHook(() => useCandidatePools(candidateWith([poolA, poolB])))
    act(() => { result.current.toggle(poolA) })
    expect(result.current.pools).toEqual([poolB])
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.pools).toHaveLength(2)
    expect(result.current.pools).toEqual(expect.arrayContaining([poolA, poolB]))
    expect(notifyError).toHaveBeenCalledWith('Verwijderen mislukt')
  })
})
