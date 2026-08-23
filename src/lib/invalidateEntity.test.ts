/**
 * invalidateCandidate (REFRESH-FIX-2) — pins the reconciliation SCOPE: every
 * candidates/applications query except the expensive 'stats' branches.
 */
import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { invalidateCandidate } from './invalidateEntity'

const keyOf = (queryKey: unknown[]) => ({ queryKey }) as unknown as { queryKey: unknown[] }

describe('invalidateCandidate', () => {
  it('targets candidates + applications queries but never their stats branches', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    invalidateCandidate(qc)
    expect(spy).toHaveBeenCalledTimes(1)
    const predicate = (spy.mock.calls[0][0] as unknown as { predicate: (q: { queryKey: unknown[] }) => boolean }).predicate
    expect(predicate(keyOf(['candidates', { status: ['available'] }, 1, 25, null]))).toBe(true)
    expect(predicate(keyOf(['candidates', 'cand-7']))).toBe(true)
    expect(predicate(keyOf(['applications', 'wide', {}, null]))).toBe(true)
    expect(predicate(keyOf(['candidates', 'stats', {}]))).toBe(false)
    expect(predicate(keyOf(['applications', 'stats', {}]))).toBe(false)
    expect(predicate(keyOf(['vacancies', {}, 1, 25, null]))).toBe(false)
  })
})
