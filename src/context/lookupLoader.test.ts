/**
 * loadTenantLookups — D8 fix: a failed/empty spec must be reported through onDone(failedUrls)
 * instead of being silently swallowed, so a consumer can distinguish "seed defaults because the
 * tenant has nothing configured yet" from "seed defaults because the fetch failed".
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import { loadTenantLookups } from './lookupLoader'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

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
})
