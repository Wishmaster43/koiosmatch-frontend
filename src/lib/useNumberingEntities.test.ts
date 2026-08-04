/**
 * useNumberingEntities (NUMBERING-LOOKUP-1) — asserts the actual GET request and
 * the full TWELVE-entity mapping, not just that data loaded (§13): the whole point
 * of this ticket is that the old hardcoded array only knew six of the twelve
 * entities config/numbering.php defines. useCachedLookup keeps a module-scope
 * cache keyed by URL, and this hook always uses the same URL, so each test
 * re-imports the module tree (vi.resetModules) to start from a cold cache.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

// Fresh module registry per test = cold lookup cache + fresh api mock.
async function mountEntities(response: unknown | Error) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  const get = vi.mocked(apiModule.default.get)
  if (response instanceof Error) get.mockRejectedValue(response)
  else get.mockResolvedValue({ data: response } as AxiosResponse)
  const { useNumberingEntities } = await import('./useNumberingEntities')
  const rendered = renderHook(() => useNumberingEntities())
  return { ...rendered, get }
}

describe('useNumberingEntities · lookup mapping', () => {
  it('reads GET /numbering-entities and maps all twelve configured entities', async () => {
    const twelve = [
      { key: 'candidate', prefix: 'K', pad: 5, start: 1, label: 'Kandidaat' },
      { key: 'customer', prefix: 'D', pad: 5, start: 1, label: 'Klant' },
      { key: 'vacancy', prefix: 'V', pad: 5, start: 1, label: 'Vacature' },
      { key: 'customer_location', prefix: 'L', pad: 3, start: 1, label: 'Vestiging klant' },
      { key: 'customer_department', prefix: 'A', pad: 3, start: 1, label: 'Afdeling klant' },
      { key: 'match', prefix: 'M', pad: 5, start: 1, label: 'Match' },
      { key: 'application', prefix: 'S', pad: 5, start: 1, label: 'Sollicitatie' },
      { key: 'task', prefix: 'T', pad: 5, start: 1, label: 'Taak' },
      { key: 'opportunity', prefix: 'KA', pad: 5, start: 1, label: 'Kans' },
      { key: 'outreach_campaign', prefix: 'B', pad: 4, start: 1, label: 'Belronde' },
      { key: 'customer_contact', prefix: 'C', pad: 5, start: 1, label: 'Contactpersoon' },
      { key: 'location', prefix: 'VE', pad: 3, start: 1, label: 'Vestiging (eigen)' },
    ]
    const { result, get } = await mountEntities(twelve)

    await waitFor(() => expect(result.current.entities).toHaveLength(12))
    expect(get).toHaveBeenCalledWith('/numbering-entities', undefined)
    expect(result.current.entities.map(e => e.key)).toEqual(twelve.map(e => e.key))
    // A backend-added string pad/start (Laravel int cast should keep it numeric,
    // but §10's numeric-string tolerance still applies) resolves to a real number.
    expect(result.current.entities[9]).toMatchObject({ key: 'outreach_campaign', pad: 4, start: 1 })
  })

  it('falls back to the seeded six when the endpoint fails — never an empty table', async () => {
    const { result } = await mountEntities(new Error('network down'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entities).toHaveLength(6)
    expect(result.current.entities.map(e => e.key)).toContain('candidate')
  })

  it('keeps the fallback on a genuinely empty response rather than emptying the table', async () => {
    const { result } = await mountEntities([])

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entities).toHaveLength(6)
  })
})
