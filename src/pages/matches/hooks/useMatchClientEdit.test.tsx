/**
 * useMatchClientEdit — K-281 repair pass regression tests (manager, Opus
 * reject): NOTE (a) the dirty-check no-op, NOTE (b) the department label's
 * location-name suffix when unfiltered, NOTE (c) the fallback option built
 * from the match row's own current name while the cascade hasn't produced a
 * matching option yet, and confirmSave's PATCH body + the names it patches
 * back via onUpdate.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { useMatchClientEdit } from './useMatchClientEdit'
import api from '@/lib/api'
import type { MatchRow } from '@/types/match'

// Only the default axios client's `patch` is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...actual.default, patch: vi.fn() } }
})
const mockedPatch = vi.mocked(api.patch)

// Fixed customer options — 'cl1'/'Zorggroep Noord' matches the fixture's own client.
vi.mock('@/hooks/useCustomerOptions', () => ({
  useCustomerOptions: () => [
    { value: 'cl1', label: 'Zorggroep Noord' },
    { value: 'cl2', label: 'Andere Zorg BV' },
  ],
}))

// Controllable per-test cascade fixture (mirrors AddVacancyModal.cascade.test.tsx's own pattern).
const { cascadeState } = vi.hoisted(() => ({
  cascadeState: {
    locations: [] as Array<{ id: string; name: string; departments?: Array<{ id: string; name: string }> }>,
  },
}))
vi.mock('@/hooks/useCustomerCascade', () => ({
  useCustomerCascade: () => ({ locations: cascadeState.locations, contacts: [], detail: null, refetch: vi.fn() }),
}))

afterEach(() => { vi.clearAllMocks(); cascadeState.locations = [] })

// A match WITH a preset site (loc1/dep1), names included — the seeded case NOTE (c) covers.
const baseMatch: MatchRow = {
  id: 'm1', candidate: 'Sam de Vries', initials: 'SV', vacancy: 'Verpleegkundige', client: 'Zorggroep Noord',
  candidateId: 'c1', vacancyId: 'v1', clientId: 'cl1', score: 80, stage: '', status: 'open', stageColor: '#000',
  owner: '', ownerId: null, ownerInitials: '', ownerColor: null, date: '2026-01-01',
  helloflexLink: null, shiftmanagerLink: null,
  // S1 repair NOTE 7: required field, unused by this hook's own logic.
  koiosAiAdvice: null,
  customerLocationId: 'loc1', customerDepartmentId: 'dep1',
  customerLocationName: 'Hoofdvestiging', customerDepartmentName: 'IC',
}
// A match WITHOUT a preset site — NOTE (b)'s "no location chosen yet" default.
const matchNoSite: MatchRow = { ...baseMatch, customerLocationId: null, customerDepartmentId: null, customerLocationName: null, customerDepartmentName: null }

function setup(match: MatchRow = baseMatch) {
  const onUpdate = vi.fn()
  const { result } = renderHook(() => useMatchClientEdit(match, onUpdate), {
    wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
  })
  return { result, onUpdate }
}

describe('useMatchClientEdit · NOTE (a) dirty check', () => {
  it('requestSave with an UNCHANGED triplet just closes the editor — no confirm, no PATCH', () => {
    const { result } = setup()
    act(() => result.current.startEdit())
    expect(result.current.editing).toBe(true)
    act(() => result.current.requestSave())
    expect(result.current.confirmOpen).toBe(false)
    expect(result.current.editing).toBe(false)
    expect(mockedPatch).not.toHaveBeenCalled()
  })

  it('requestSave with a CHANGED customer opens the confirm step', () => {
    const { result } = setup()
    act(() => result.current.startEdit())
    act(() => result.current.handleCustomerChange('cl2'))
    act(() => result.current.requestSave())
    expect(result.current.confirmOpen).toBe(true)
    expect(result.current.editing).toBe(true)
  })
})

describe('useMatchClientEdit · NOTE (b) department option carries its location name when unfiltered', () => {
  it('suffixes each department option with its own location name', () => {
    cascadeState.locations = [
      { id: 'loc1', name: 'Hoofdvestiging', departments: [{ id: 'dep1', name: 'IC' }] },
      { id: 'loc2', name: 'Vestiging Zuid', departments: [{ id: 'dep2', name: 'IC' }] },
    ]
    const { result } = setup(matchNoSite)
    act(() => result.current.startEdit())
    const labels = result.current.departmentOptions.map(o => o.label)
    expect(labels).toContain('IC · Hoofdvestiging')
    expect(labels).toContain('IC · Vestiging Zuid')
  })

  it('drops the suffix once a location narrows the list', () => {
    cascadeState.locations = [{ id: 'loc1', name: 'Hoofdvestiging', departments: [{ id: 'dep1', name: 'IC' }] }]
    const { result } = setup(matchNoSite)
    act(() => result.current.startEdit())
    act(() => result.current.handleLocationChange('loc1'))
    expect(result.current.departmentOptions.map(o => o.label)).toEqual(['IC'])
  })
})

describe('useMatchClientEdit · NOTE (c) fallback option for the SEEDED id', () => {
  it('shows the match row\'s own current location/department name before the cascade has loaded', () => {
    // cascadeState.locations stays [] — the loading window this note targets.
    const { result } = setup()
    act(() => result.current.startEdit())
    expect(result.current.locationOptions).toEqual([{ value: 'loc1', label: 'Hoofdvestiging' }])
    expect(result.current.departmentOptions).toEqual([{ value: 'dep1', label: 'IC' }])
  })

  it('never fabricates a fallback for a freshly-typed pick that genuinely has no match', () => {
    const { result } = setup()
    act(() => result.current.startEdit())
    act(() => result.current.handleCustomerChange('cl2')) // resets location/department to ''
    act(() => result.current.handleLocationChange('loc-unknown'))
    expect(result.current.locationOptions.some(o => o.value === 'loc-unknown')).toBe(false)
  })

  it('prefers the loaded cascade option over the fallback once it lands', () => {
    cascadeState.locations = [{ id: 'loc1', name: 'Hoofdvestiging (bijgewerkt)', departments: [{ id: 'dep1', name: 'IC' }] }]
    const { result } = setup()
    act(() => result.current.startEdit())
    expect(result.current.locationOptions).toEqual([{ value: 'loc1', label: 'Hoofdvestiging (bijgewerkt)' }])
  })
})

describe('useMatchClientEdit · confirmSave', () => {
  it('PATCHes the exact request body and patches back the resolved names via onUpdate', async () => {
    cascadeState.locations = []
    mockedPatch.mockResolvedValue({ data: { data: {} } })
    const { result, onUpdate } = setup()
    act(() => result.current.startEdit())
    act(() => result.current.handleCustomerChange('cl2'))
    act(() => result.current.requestSave())
    await act(async () => { await result.current.confirmSave() })
    expect(mockedPatch).toHaveBeenCalledWith('/matches/m1', {
      customer_id: 'cl2', customer_location_id: null, customer_department_id: null,
    })
    // K-281 repair pass 3 (Opus find): `client` is the VACANCY's customer and
    // this PATCH never touches it — the optimistic patch updates `customerName`
    // (this match's OWN customer) instead, never `client`.
    expect(onUpdate).toHaveBeenCalledWith('m1', expect.objectContaining({
      clientId: 'cl2', customerName: 'Andere Zorg BV', customerLocationId: null, customerDepartmentId: null,
    }))
    expect(onUpdate).not.toHaveBeenCalledWith('m1', expect.objectContaining({ client: expect.anything() }))
  })

  it('restores the ORIGINAL triplet and surfaces the server message on a failed save', async () => {
    mockedPatch.mockRejectedValue({ response: { data: { message: 'Klant kan niet gewijzigd worden.' } } })
    const { result } = setup()
    act(() => result.current.startEdit())
    act(() => result.current.handleCustomerChange('cl2'))
    act(() => result.current.requestSave())
    await act(async () => { await result.current.confirmSave() })
    expect(result.current.customerId).toBe('cl1')
    expect(result.current.error).toBe('Klant kan niet gewijzigd worden.')
    expect(result.current.editing).toBe(true)
  })
})
