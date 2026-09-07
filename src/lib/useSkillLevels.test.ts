/**
 * useSkillLevels — LOOKUP-ICON-1 coverage: the hook now returns full
 * {value,label,icon,color,key} objects (was string[]), plus a backward-compatible
 * `names` string list for old call-sites. The shared fetch/cache/dedupe plumbing
 * already has its own coverage in useCachedLookup.test.ts.
 * KEY-ADOPTION: the key field holds the stable lookup row identifier.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import api from '@/lib/api'
import { useSkillLevels, DEFAULT_SKILL_LEVEL_ITEMS } from './useSkillLevels'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('useSkillLevels', () => {
  // The GET never resolves in this test — the hook stays on its seed fallback
  // for the whole test (mirrors useDocumentTypes.test.ts's pattern), no
  // module-scope cache pollution across tests in this file.
  it('falls back to full seed objects (not plain strings) while the API is pending', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSkillLevels())
    expect(result.current.levels).toEqual(DEFAULT_SKILL_LEVEL_ITEMS)
    expect(result.current.names).toEqual(['Basis', 'Gevorderd', 'Expert'])
  })

  // The real shape LOOKUP-ICON-1 wires up: icon travels through untouched. A
  // FRESH module instance (vi.resetModules) is needed here: the test above
  // mounts the hook on a never-resolving GET, which otherwise claims
  // useCachedLookup's module-scope inFlight slot for '/skill-levels?active=1' for the
  // rest of this file's run (mirrors useDocumentTypes.test.ts's identical fix).
  it('carries the icon/color/key fields through from a real API response', async () => {
    vi.resetModules()
    const freshApi = (await import('@/lib/api')).default
    vi.mocked(freshApi.get).mockResolvedValue({ data: { data: [{ name: 'Expert', key: 'expert_key', icon: 'star', color: 'rgb(59, 143, 212)' }] } })
    const { useSkillLevels: freshUseSkillLevels } = await import('./useSkillLevels')

    const { result, rerender } = renderHook(() => freshUseSkillLevels())
    await vi.waitFor(() => {
      rerender()
      expect(result.current.levels).toEqual([{ value: 'Expert', label: 'Expert', key: 'expert_key', icon: 'star', color: 'rgb(59, 143, 212)' }])
    })
    expect(result.current.names).toEqual(['Expert'])
  })

  // KEY-ADOPTION: a renamed label still selects the row by key.
  it('preserves the key when the label is renamed', async () => {
    vi.resetModules()
    const freshApi = (await import('@/lib/api')).default
    vi.mocked(freshApi.get).mockResolvedValue({ data: { data: [{ name: 'Senior', key: 'expert_key', icon: 'star', color: 'rgb(59, 143, 212)' }] } })
    const { useSkillLevels: freshUseSkillLevels } = await import('./useSkillLevels')

    const { result, rerender } = renderHook(() => freshUseSkillLevels())
    await vi.waitFor(() => {
      rerender()
      // The key stays stable even though the label changed from 'Expert' to 'Senior'
      expect(result.current.levels[0].key).toBe('expert_key')
      expect(result.current.levels[0].label).toBe('Senior')
    })
  })
})
