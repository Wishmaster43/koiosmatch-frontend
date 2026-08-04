/**
 * useListPageSize — the shared page-size hook every list page adopts (audit
 * 2026-08-05: "Rijen per pagina staat op 500 ... maar wordt niet overal
 * toegepast"). Covers: seeding from user.default_per_page (fallback 50),
 * clamping to a per-endpoint server cap (never offers/sets a size the
 * backend would 422 on), and stickiness across a remount (the root cause of
 * "Sollicitaties: rows per page kan niet op 50 gezet worden" — pageSize used
 * to reset to the seeded default on every page unmount/remount).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useListPageSize } from './useListPageSize'

// Mutable mock user — each test sets its own default_per_page.
let mockUser: { default_per_page?: number } | null = null
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

describe('useListPageSize · seeding', () => {
  it('falls back to 50 when the user has no saved preference', () => {
    mockUser = null
    const { result } = renderHook(() => useListPageSize('test.seed.none'))
    expect(result.current.pageSize).toBe(50)
  })

  it('seeds from user.default_per_page when no cap applies', () => {
    mockUser = { default_per_page: 500 }
    const { result } = renderHook(() => useListPageSize('test.seed.500'))
    expect(result.current.pageSize).toBe(500)
  })
})

describe('useListPageSize · honesty (server cap)', () => {
  it('clamps the seeded default to the endpoint cap — a 500 preference never 422s', () => {
    mockUser = { default_per_page: 500 }
    const { result } = renderHook(() => useListPageSize('test.cap.seed', 200))
    expect(result.current.pageSize).toBe(200)
  })

  it('never offers a dropdown option above the cap', () => {
    mockUser = { default_per_page: 500 }
    const { result } = renderHook(() => useListPageSize('test.cap.options', 200))
    expect(result.current.options).toEqual([50, 100, 200])
    expect(Math.max(...result.current.options)).toBeLessThanOrEqual(200)
  })

  it('offers the full shared list when no cap is passed', () => {
    mockUser = { default_per_page: 50 }
    const { result } = renderHook(() => useListPageSize('test.cap.none'))
    expect(result.current.options).toEqual([50, 100, 200, 300, 400, 500])
  })

  it('re-clamps an explicit setPageSize call above the cap', () => {
    mockUser = { default_per_page: 50 }
    const { result } = renderHook(() => useListPageSize('test.cap.setabove', 200))
    act(() => result.current.setPageSize(500))
    expect(result.current.pageSize).toBe(200)
  })
})

describe('useListPageSize · stickiness across remount', () => {
  it('keeps an explicit pick after the component unmounts and remounts (usePageMemory)', () => {
    mockUser = { default_per_page: 500 }
    const key = 'test.sticky.pick'
    const { result, unmount } = renderHook(() => useListPageSize(key))
    act(() => result.current.setPageSize(50))
    expect(result.current.pageSize).toBe(50)
    unmount()

    // A fresh mount (mirrors the shell unmounting the page on navigation) must
    // keep the user's explicit choice, not reset to the seeded default (500).
    const { result: result2 } = renderHook(() => useListPageSize(key))
    expect(result2.current.pageSize).toBe(50)
  })
})
