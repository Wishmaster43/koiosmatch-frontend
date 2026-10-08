/**
 * loadTenantLookups — D8 fix: a failed/empty spec must be reported through onDone(failedUrls)
 * instead of being silently swallowed, so a consumer can distinguish "seed defaults because the
 * tenant has nothing configured yet" from "seed defaults because the fetch failed".
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import { loadTenantLookups, clearRecentLookups, setRecentLookupWindow, RECENT_LOOKUP_MS } from './lookupLoader'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => { vi.clearAllMocks(); clearRecentLookups(); setRecentLookupWindow(0); vi.useRealTimers() })

describe('loadTenantLookups', () => {
  it('reports no failed URLs and applies every response when all specs succeed', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/a' ? ['a1'] : ['b1'] }))
    const setA = vi.fn()
    const setB = vi.fn()
    const onDone = vi.fn()

    loadTenantLookups<string[]>(
      [{ url: '/a', fallback: [], set: setA }, { url: '/b', fallback: [], set: setB }],
      (raw) => raw as string[],
      onDone,
    )

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(onDone).toHaveBeenCalledWith([])
    expect(setA).toHaveBeenCalledWith(['a1'])
    expect(setB).toHaveBeenCalledWith(['b1'])
  })

  it('names the failed URL in onDone while the other spec still applies its own response', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/broken' ? Promise.reject(new Error('500')) : Promise.resolve({ data: ['ok'] }))
    const setOk = vi.fn()
    const setBroken = vi.fn()
    const onDone = vi.fn()

    loadTenantLookups<string[]>(
      [{ url: '/ok', fallback: [], set: setOk }, { url: '/broken', fallback: ['seed'], set: setBroken }],
      (raw) => raw as string[],
      onDone,
    )

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(onDone).toHaveBeenCalledWith(['/broken'])
    expect(setOk).toHaveBeenCalledWith(['ok'])
    expect(setBroken).not.toHaveBeenCalled()
  })

  it('stays compatible with a zero-arg onDone (existing TaskLookupsContext/VacancyLookupsContext call shape)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    const onDone = vi.fn(() => {})

    loadTenantLookups<string[]>([{ url: '/x', fallback: [], set: vi.fn() }], (raw) => raw as string[], onDone)

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  // LOOKUP-DEDUPE-1: two loadTenantLookups calls that hit the SAME url within the
  // same tick (e.g. two provider mounts) share one api.get for that url.
  it('shares one request when two calls load the same url concurrently', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: ['shared'] })
    const setA1 = vi.fn()
    const setA2 = vi.fn()
    const onDoneA = vi.fn()
    const onDoneB = vi.fn()

    loadTenantLookups<string[]>([{ url: '/shared-lookup', fallback: [], set: setA1 }], (raw) => raw as string[], onDoneA)
    loadTenantLookups<string[]>([{ url: '/shared-lookup', fallback: [], set: setA2 }], (raw) => raw as string[], onDoneB)

    await vi.waitFor(() => expect(onDoneA).toHaveBeenCalled())
    await vi.waitFor(() => expect(onDoneB).toHaveBeenCalled())

    expect(api.get).toHaveBeenCalledTimes(1)
    expect(setA1).toHaveBeenCalledWith(['shared'])
    expect(setA2).toHaveBeenCalledWith(['shared'])
  })
})

// LOOKUP-RECENT-1: a mount within the recent window reuses the remembered answer; a mount
// after the window fetches again (settings edits stay fresh); a failure is never remembered.
describe('loadTenantLookups · recent-result window (LOOKUP-RECENT-1)', () => {
  // Runs one loader call for `url` and resolves once its onDone fired.
  const load = (url: string, set = vi.fn()) => new Promise<void>(resolve => {
    loadTenantLookups<string[]>([{ url, fallback: [], set }], raw => raw as string[], () => resolve())
  })

  it('reuses the answer for a later mount inside the window, and refetches after it', async () => {
    setRecentLookupWindow(RECENT_LOOKUP_MS)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T10:00:00Z'))
    vi.mocked(api.get).mockResolvedValue({ data: ['fresh'] })
    const set1 = vi.fn(); const set2 = vi.fn(); const set3 = vi.fn()
    await load('/recent-lookup', set1)
    vi.setSystemTime(new Date('2026-10-08T10:00:01Z'))
    await load('/recent-lookup', set2)
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(set2).toHaveBeenCalledWith(['fresh'])
    vi.setSystemTime(new Date(Date.parse('2026-10-08T10:00:00Z') + RECENT_LOOKUP_MS + 1))
    await load('/recent-lookup', set3)
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(set3).toHaveBeenCalledWith(['fresh'])
  })

  it('never remembers a failure: the next mount retries', async () => {
    setRecentLookupWindow(RECENT_LOOKUP_MS)
    vi.mocked(api.get).mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({ data: ['later'] })
    await load('/flaky-lookup')
    const set = vi.fn()
    await load('/flaky-lookup', set)
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(set).toHaveBeenCalledWith(['later'])
  })
})
