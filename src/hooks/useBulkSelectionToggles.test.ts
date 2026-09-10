import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBulkSelectionToggles } from './useBulkSelectionToggles'

// useBulkSelectionToggles — the row/select-all toggle pair shared by every
// bulk-selection hook (candidates/customers/vacancies/tasks/matches/
// applications/opportunities). Asserts the Set updater semantics, not just
// that the callbacks fire (DRY round 11, BULKBARS).
describe('useBulkSelectionToggles', () => {
  it('toggleRow adds an id not yet in the set', () => {
    const setSelectedIds = vi.fn()
    const { result } = renderHook(() => useBulkSelectionToggles(setSelectedIds))
    result.current.toggleRow('a')
    const updater = setSelectedIds.mock.calls[0][0]
    expect(updater(new Set())).toEqual(new Set(['a']))
  })

  it('toggleRow removes an id already in the set', () => {
    const setSelectedIds = vi.fn()
    const { result } = renderHook(() => useBulkSelectionToggles(setSelectedIds))
    result.current.toggleRow('a')
    const updater = setSelectedIds.mock.calls[0][0]
    expect(updater(new Set(['a', 'b']))).toEqual(new Set(['b']))
  })

  it('toggleAll adds every id when none were selected', () => {
    const setSelectedIds = vi.fn()
    const { result } = renderHook(() => useBulkSelectionToggles(setSelectedIds))
    result.current.toggleAll(['a', 'b'], false)
    const updater = setSelectedIds.mock.calls[0][0]
    expect(updater(new Set())).toEqual(new Set(['a', 'b']))
  })

  it('toggleAll removes every id when all were selected', () => {
    const setSelectedIds = vi.fn()
    const { result } = renderHook(() => useBulkSelectionToggles(setSelectedIds))
    result.current.toggleAll(['a', 'b'], true)
    const updater = setSelectedIds.mock.calls[0][0]
    expect(updater(new Set(['a', 'b', 'c']))).toEqual(new Set(['c']))
  })
})
