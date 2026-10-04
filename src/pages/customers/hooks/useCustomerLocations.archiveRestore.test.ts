/**
 * archiveLocation / restoreLocation — IDEMP-KEY-BODYLESS-1: these body-less POSTs
 * now carry a per-click Idempotency-Key so a double click never fires the same
 * archive/restore mutation twice at the server (§13 request-asserting test).
 */
import { describe, it, expect, vi } from 'vitest'
import { archiveLocation, restoreLocation, LOCATIONS_CHANGED_EVENT } from './useCustomerLocations'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  unwrap: (res: { data?: unknown }) => {
    const body = (res as { data?: unknown })?.data ?? res
    return (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object))
      ? (body as { data: unknown }).data
      : body
  },
  unwrapList: vi.fn(),
}))

describe('useCustomerLocations · archiveLocation / restoreLocation (ARCHIVE-SUBENTITY-1)', () => {
  it('archiveLocation sends an Idempotency-Key with the body-less archive POST', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const onChanged = vi.fn()
    window.addEventListener(LOCATIONS_CHANGED_EVENT, onChanged)

    await archiveLocation('cust1', 'l1')

    expect(api.post).toHaveBeenCalledWith('/customers/cust1/locations/l1/archive', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(onChanged).toHaveBeenCalledTimes(1)
    window.removeEventListener(LOCATIONS_CHANGED_EVENT, onChanged)
  })

  it('restoreLocation sends an Idempotency-Key with the body-less restore POST', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'l1', name: 'Acme HQ', archived: false } } })
    const onChanged = vi.fn()
    window.addEventListener(LOCATIONS_CHANGED_EVENT, onChanged)

    const restored = await restoreLocation('cust1', 'l1')

    expect(api.post).toHaveBeenCalledWith('/customers/cust1/locations/l1/restore', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(restored.id).toBe('l1')
    expect(onChanged).toHaveBeenCalledTimes(1)
    window.removeEventListener(LOCATIONS_CHANGED_EVENT, onChanged)
  })
})
