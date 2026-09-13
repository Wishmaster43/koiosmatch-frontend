/**
 * usePagedRows — the shared client-side pagination slice, shared by the
 * Shiftmanager Contacts/Departments/Locations pages (see file doc).
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagedRows } from './usePagedRows'

describe('usePagedRows', () => {
  it('slices the first page at the default page size', () => {
    const rows = Array.from({ length: 120 }, (_, i) => i)
    const { result } = renderHook(() => usePagedRows(rows))
    expect(result.current.paged).toEqual(rows.slice(0, 50))
    expect(result.current.totalPages).toBe(3)
  })
  it('advances page via its own setPage', () => {
    const rows = Array.from({ length: 120 }, (_, i) => i)
    const { result } = renderHook(() => usePagedRows(rows))
    act(() => result.current.setPage(2))
    expect(result.current.paged).toEqual(rows.slice(50, 100))
  })
  it('an external pageSize/setPageSize wins over the internal state (DepartmentsPage case)', () => {
    const rows = Array.from({ length: 30 }, (_, i) => i)
    let externalSize = 10
    const setExternal = (n: number) => { externalSize = n }
    const { result, rerender } = renderHook(() => usePagedRows(rows, { pageSize: externalSize, setPageSize: setExternal }))
    expect(result.current.pageSize).toBe(10)
    expect(result.current.totalPages).toBe(3)
    act(() => result.current.setPageSize(15))
    rerender()
    expect(externalSize).toBe(15)
  })
})
