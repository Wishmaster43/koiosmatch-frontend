/**
 * useEducationLevels — LOOKUP-ICON-1 coverage for the new `icon` field alongside
 * the existing id/label/color shape. The shared fetch/cache/dedupe plumbing
 * already has its own coverage in useCachedLookup.test.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import api from '@/lib/api'
import { useEducationLevels, DEFAULT_EDUCATION_LEVELS } from './useEducationLevels'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('useEducationLevels', () => {
  it('falls back to the seed levels (no icon) while the API is pending', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useEducationLevels())
    expect(result.current.levels).toEqual(DEFAULT_EDUCATION_LEVELS)
  })

  // The real shape LOOKUP-ICON-1 wires up: icon travels through alongside id/color.
  // A FRESH module instance (vi.resetModules) is needed here: every other test in
  // this file mounts the hook on a never-resolving GET, which otherwise claims
  // useCachedLookup's module-scope inFlight slot for '/education-levels' for the
  // rest of this file's run (mirrors useDocumentTypes.test.ts's identical fix).
  it('carries id, color and icon through from a real API response', async () => {
    vi.resetModules()
    const freshApi = (await import('@/lib/api')).default
    vi.mocked(freshApi.get).mockResolvedValue({ data: { data: [{ id: 'lvl-1', name: 'HBO', color: '#6E8FD6', icon: 'graduation-cap' }] } })
    const { useEducationLevels: freshUseEducationLevels } = await import('./useEducationLevels')

    const { result, rerender } = renderHook(() => freshUseEducationLevels())
    await vi.waitFor(() => {
      rerender()
      expect(result.current.levels).toEqual([{ id: 'lvl-1', label: 'HBO', color: '#6E8FD6', icon: 'graduation-cap' }])
    })
  })
})
