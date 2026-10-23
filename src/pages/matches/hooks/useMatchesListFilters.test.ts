/**
 * useMatchesListFilters — the client-side predicate and intent seeding moved
 * out of MatchesPage; the in-memory page store is reset between tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMatchesListFilters } from './useMatchesListFilters'
import { __resetPageMemoryForTests } from '@/lib/usePageMemory'
import type { MatchRow } from '@/types/match'

vi.mock('@/lib/useContractTypes', () => ({
  useContractTypes: () => ({ options: [{ value: 'fixed', label: 'Fixed term' }] }),
}))

const row = (o: Record<string, unknown>) => ({ id: 'x', status: 's1', owner: 'o1', client: 'c1', candidate: 'Anna', vacancy: 'Welder', ...o }) as unknown as MatchRow
const rows = [
  row({ id: 'a', score: 80, contractType: 'fixed', date: '2026-02-10' }),
  row({ id: 'b', status: 's2', owner: 'o2', client: 'c2', branchName: 'B1', contractForm: { value: 'flex' }, approval_status: 'pending', candidate: 'Bram' }),
  row({ id: 'c', archived: true, lifecycle: 'archived' }),
  row({ id: 'd', archived: true, lifecycle: 'pending_erase' }),
]
const setPending = vi.fn()
const run = (o: Record<string, unknown> = {}) => renderHook(() => useMatchesListFilters({
  rows, query: '', refQuery: null, showArchived: false, showTrash: false, pendingApprovalOnly: false,
  setPendingApprovalOnly: setPending, approvalReviewVisible: true, ...o,
}))
const ids = (r: { current: { filteredAll: MatchRow[] } }) => r.current.filteredAll.map(m => m.id)

beforeEach(() => { __resetPageMemoryForTests(); setPending.mockClear() })

describe('useMatchesListFilters', () => {
  it('applies the lifecycle views', () => {
    expect(ids(run().result)).toEqual(['a', 'b'])
    expect(ids(run({ showArchived: true }).result)).toEqual(['c'])
    expect(ids(run({ showTrash: true }).result)).toEqual(['d'])
  })

  it('narrows by stage, owner, client, branch and contract form', async () => {
    const { result, rerender } = run()
    const { act } = await import('@testing-library/react')
    act(() => result.current.setStageFilter(['s2']))
    expect(ids(result)).toEqual(['b'])
    act(() => result.current.setStageFilter([]))
    act(() => result.current.setOwnerFilter(['o1']))
    expect(ids(result)).toEqual(['a'])
    act(() => result.current.setOwnerFilter([]))
    act(() => result.current.setClientFilter(['c2']))
    expect(ids(result)).toEqual(['b'])
    act(() => result.current.setClientFilter([]))
    act(() => result.current.setBranchFilter(['B1']))
    expect(ids(result)).toEqual(['b'])
    act(() => result.current.setBranchFilter([]))
    act(() => result.current.setContractFormFilter(['flex']))
    expect(ids(result)).toEqual(['b'])
    rerender()
  })

  it('matches contract type by value and by label, and scored/unscored', async () => {
    const { act } = await import('@testing-library/react')
    const { result } = run()
    act(() => result.current.setContractTypeFilter(['fixed']))
    expect(ids(result)).toEqual(['a'])
    act(() => result.current.setContractTypeFilter([]))
    // A row carrying the lookup LABEL instead of the value still matches
    const { result: lr } = run({ rows: [row({ id: 'e', contractType: 'Fixed term' })] })
    act(() => lr.current.setContractTypeFilter(['fixed']))
    expect(ids(lr)).toEqual(['e'])
    __resetPageMemoryForTests()
    act(() => result.current.setKpiScored(true))
    expect(ids(result)).toEqual(['a'])
    act(() => { result.current.setKpiScored(false); result.current.setKpiUnscored(true) })
    expect(ids(result)).toEqual(['b'])
  })

  it('applies pendingApprovalOnly only when the review is visible', () => {
    expect(ids(run({ pendingApprovalOnly: true }).result)).toEqual(['b'])
    expect(ids(run({ pendingApprovalOnly: true, approvalReviewVisible: false }).result)).toEqual(['a', 'b'])
  })

  it('filters by date range and free text, skipping text for a reference query', async () => {
    const { act } = await import('@testing-library/react')
    const { result } = run()
    act(() => result.current.setDateRange({ from: '2026-02-01', to: '2026-02-28' } as never))
    expect(ids(result)).toEqual(['a'])
    __resetPageMemoryForTests()
    expect(ids(run({ query: 'bram' }).result)).toEqual(['b'])
    expect(ids(run({ query: 'M-00042', refQuery: 'M-00042' }).result)).toEqual(['a', 'b'])
  })

  it('seeds filters from the intent, gating pending approval', () => {
    const r = run({ intent: { contract_form: 'flex', contract_type: 'fixed', pendingApprovalOnly: true } })
    expect(r.result.current.contractFormFilter).toEqual(['flex'])
    expect(r.result.current.contractTypeFilter).toEqual(['fixed'])
    expect(setPending).toHaveBeenCalledWith(true)
    setPending.mockClear()
    run({ intent: { pendingApprovalOnly: true }, approvalReviewVisible: false })
    expect(setPending).not.toHaveBeenCalled()
  })
})
