/**
 * useCustomFields — regression test for the generic per-entity custom-fields hook
 * (§3B "Eigen velden" wave): active-language label pick, active+visible_in_ui
 * filtering (worklist #44 — API-only fields), the per-tenant+entity-type session
 * cache (one fetch per tenant+entity type, not one global fetch), invalidate()
 * scoping to a single entity type, and (below) tenant-scoping — a bureau switch
 * must never serve a PREVIOUS tenant's custom-field defs (bijvangst fix, 2026-08,
 * same class of gap fixed on useCachedLookup — see its test file).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import '@/i18n'
import { useCustomFields } from './useCustomFields'
import api, { getActiveTenantId } from '@/lib/api'

// Keep the real unwrap/unwrapList (importActual) — only the default client and
// getActiveTenantId are stubbed (the latter overridden per-call below to simulate
// a bureau switch mid-session).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() }, getActiveTenantId: vi.fn(() => null) }
})
const mockedGet = vi.mocked(api.get)
const mockedTenantId = vi.mocked(getActiveTenantId)

// clearAllMocks() clears call history but NOT a mockReturnValue set inside a test
// (that's mockReset) — restore the "no tenant" default explicitly so a tenant
// override in one test never leaks into the next.
afterEach(() => {
  vi.clearAllMocks()
  mockedTenantId.mockReturnValue(null)
})

describe('useCustomFields', () => {
  it('picks the active-language label and normalises active/in_use', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          { id: '1', key: 'budget', label_i18n: { nl: 'Budget', en: 'Budget (EN)' }, type: 'number', active: true, in_use: true },
          { id: '2', key: 'archived_field', label_i18n: { nl: 'Oud veld' }, type: 'text', active: false, in_use: false },
        ],
      },
    })
    const { result } = renderHook(() => useCustomFields('task'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // allFields carries every def, in the active (nl) language.
    expect(result.current.allFields).toHaveLength(2)
    expect(result.current.allFields[0]).toMatchObject({ key: 'budget', label: 'Budget', has_data: true })

    // fields = active-only (the drawer tab + gating both read this filtered list).
    expect(result.current.fields).toHaveLength(1)
    expect(result.current.fields[0].key).toBe('budget')
  })

  it('falls back key → en → nl → any when a label is missing for the active language', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: '1', key: 'plate', type: 'text', active: true }] } })
    const { result } = renderHook(() => useCustomFields('vacancy'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    // No label_i18n at all → falls all the way back to the key.
    expect(result.current.fields[0].label).toBe('plate')
  })

  it('fetches once per entity type — a second hook for the SAME type reuses the cache', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: '1', key: 'x', type: 'text', active: true }] } })
    const first = renderHook(() => useCustomFields('opportunity'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    const second = renderHook(() => useCustomFields('opportunity'))
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('caches PER entity type — a different entity type triggers its own fetch', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const a = renderHook(() => useCustomFields('match'))
    await waitFor(() => expect(a.result.current.loading).toBe(false))
    const b = renderHook(() => useCustomFields('customer'))
    await waitFor(() => expect(b.result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledTimes(2)
    expect(mockedGet).toHaveBeenCalledWith('/custom-fields', { params: { entity_type: 'match' } })
    expect(mockedGet).toHaveBeenCalledWith('/custom-fields', { params: { entity_type: 'customer' } })
  })

  it('invalidate() clears the cache for that entity type only, so the next mount refetches', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const first = renderHook(() => useCustomFields('outreach_campaign'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    first.result.current.invalidate()
    const second = renderHook(() => useCustomFields('outreach_campaign'))
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  // Worklist #44: visible_in_ui: false ("API only") stays active/writable via the
  // API/imports (allFields keeps it) but must not render on the entity's Extra tab
  // (fields excludes it) — this is the ONE choke point every drawer gates on.
  it('excludes an active-but-API-only field (visible_in_ui: false) from fields, keeps it in allFields', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          { id: '1', key: 'shown', label_i18n: { en: 'Shown' }, type: 'text', active: true, visible_in_ui: true },
          { id: '2', key: 'api_only', label_i18n: { en: 'API only field' }, type: 'text', active: true, visible_in_ui: false },
        ],
      },
    })
    const { result } = renderHook(() => useCustomFields('customer_location'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // allFields carries both — settings still manages the API-only field.
    expect(result.current.allFields).toHaveLength(2)
    expect(result.current.allFields.find(f => f.key === 'api_only')).toMatchObject({ visible_in_ui: false })

    // fields (what the Extra tab renders + gates on) drops the API-only one.
    expect(result.current.fields).toHaveLength(1)
    expect(result.current.fields[0].key).toBe('shown')
  })

  // A field with no visible_in_ui key at all (older seed data) defaults to visible —
  // matches the backend's own `?? true` default (CustomFieldDefinitionResource).
  it('defaults visible_in_ui to true when the API omits the key', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: '1', key: 'legacy', type: 'text', active: true }] } })
    const { result } = renderHook(() => useCustomFields('customer_department'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.fields).toHaveLength(1)
  })

  // When EVERY active def is API-only, fields is empty — every consuming drawer
  // gates the Extra tab on `fields.length > 0`, so the tab itself disappears too.
  it('fields is empty when every active def is API-only, so the Extra tab gate collapses', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [
          { id: '1', key: 'a', type: 'text', active: true, visible_in_ui: false },
          { id: '2', key: 'b', type: 'text', active: true, visible_in_ui: false },
        ],
      },
    })
    const { result } = renderHook(() => useCustomFields('customer_contact'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.fields).toHaveLength(0)
    expect(result.current.allFields).toHaveLength(2)
  })
})

// Tenant-scoping regression (bijvangst fix, 2026-08): the module-scope cacheByEntity
// Map used to key purely on entityType, so a super-admin switching bureaus mid-session
// could read the PREVIOUS tenant's custom-field defs from cache. Each test below uses
// its own tenant id (even where the entity type repeats) so the module-scope cache
// never leaks state between tests, mirroring useCachedLookup.test.ts's convention.
describe('useCustomFields · tenant scoping', () => {
  // (i) Same tenant, same entity type, second mount: one GET, cache reused —
  // unchanged behaviour, asserted explicitly so the tenant key never regresses the dedupe.
  it('reuses the cache when the tenant is unchanged', async () => {
    mockedTenantId.mockReturnValue('tenant-cf-same')
    mockedGet.mockResolvedValue({ data: { data: [{ id: '1', key: 'a_field', type: 'text', active: true }] } })

    const first = renderHook(() => useCustomFields('candidate'))
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    const second = renderHook(() => useCustomFields('candidate'))
    expect(second.result.current.loading).toBe(false)
    expect(second.result.current.allFields[0].key).toBe('a_field')
    expect(mockedGet).toHaveBeenCalledTimes(1) // still just the one GET
  })

  // (j) Same entity type, DIFFERENT active tenant: must refetch and must NOT hand
  // back tenant A's cached defs to tenant B — this is the actual vulnerability.
  it('refetches (and never leaks the previous tenant\'s defs) after a tenant switch', async () => {
    mockedTenantId.mockReturnValue('tenant-cf-switch-a')
    mockedGet.mockResolvedValue({ data: { data: [{ id: '1', key: 'field_a', type: 'text', active: true }] } })

    const forTenantA = renderHook(() => useCustomFields('application'))
    await waitFor(() => expect(forTenantA.result.current.loading).toBe(false))
    expect(forTenantA.result.current.allFields.map(f => f.key)).toEqual(['field_a'])
    expect(mockedGet).toHaveBeenCalledTimes(1)

    // Simulate the switch: X-Tenant now resolves to a different tenant.
    mockedTenantId.mockReturnValue('tenant-cf-switch-b')
    mockedGet.mockResolvedValue({ data: { data: [{ id: '2', key: 'field_b', type: 'text', active: true }] } })

    const forTenantB = renderHook(() => useCustomFields('application'))
    await waitFor(() => expect(forTenantB.result.current.loading).toBe(false))
    expect(forTenantB.result.current.allFields.map(f => f.key)).toEqual(['field_b'])
    expect(mockedGet).toHaveBeenCalledTimes(2) // a real second GET, not a cache hit
  })

  // (k) invalidate() only clears the CURRENT tenant's slot — switching back to
  // tenant A afterwards must still find A's entry cached (untouched by B's call).
  it('invalidate() only clears the active tenant\'s cache slot, not other tenants\'', async () => {
    mockedTenantId.mockReturnValue('tenant-cf-inv-a')
    mockedGet.mockResolvedValue({ data: { data: [{ id: '1', key: 'inv_a', type: 'text', active: true }] } })

    const forTenantA = renderHook(() => useCustomFields('candidate'))
    await waitFor(() => expect(forTenantA.result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledTimes(1)

    mockedTenantId.mockReturnValue('tenant-cf-inv-b')
    mockedGet.mockResolvedValue({ data: { data: [{ id: '2', key: 'inv_b', type: 'text', active: true }] } })
    const forTenantB = renderHook(() => useCustomFields('candidate'))
    await waitFor(() => expect(forTenantB.result.current.loading).toBe(false))
    forTenantB.result.current.invalidate() // clears only tenant-b's slot

    mockedTenantId.mockReturnValue('tenant-cf-inv-a')
    const backToTenantA = renderHook(() => useCustomFields('candidate'))
    expect(backToTenantA.result.current.allFields.map(f => f.key)).toEqual(['inv_a']) // still cached, no 3rd GET
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })
})
