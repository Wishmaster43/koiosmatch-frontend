import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCustomerLookups } from './useCustomerLookups'

// One stable `t` and `i18n` for the whole suite: a fresh object per render would defeat the memos under test.
const stableT = vi.hoisted(() => (k: string) => k)
const stableI18n = vi.hoisted(() => ({ exists: () => false }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: stableT, i18n: stableI18n }) }))
// The seed translation is not under test: pass the rows through unchanged, but record the call (the checker rides along as the fourth argument).
const translateSeedList = vi.hoisted(() => vi.fn((_t: unknown, _k: string, list: unknown) => list))
vi.mock('./lookupSeedI18n', () => ({ translateSeedList }))
// The cached lookup answers one fixed object (its own memo keeps it stable in the real hook).
const DATA = vi.hoisted(() => ({
  statuses: [{ value: 'active', label: 'Actief', color: 'c-success' }],
  locationStatuses: [{ value: 'open', label: 'Open', color: 'c-info' }],
  departmentStatuses: [{ value: 'open', label: 'Open', color: 'c-info' }],
  contactStatuses: [{ value: 'active', label: 'Actief', color: 'c-success' }],
}))
vi.mock('./useCachedLookup', () => ({ useCachedLookup: () => ({ data: DATA, loading: false }) }))

// MAP-HOST-MEMO follow-up: the customers map pane keys a useCallback on statusMeta, so the
// helper must keep its identity across renders while the list is unchanged.
describe('useCustomerLookups · stable meta helpers', () => {
  it('keeps every meta helper identity across a re-render with the same lists', () => {
    const { result, rerender } = renderHook(() => useCustomerLookups())
    const first = result.current
    rerender()
    const second = result.current
    expect(second.statusMeta).toBe(first.statusMeta)
    expect(second.locationStatusMeta).toBe(first.locationStatusMeta)
    expect(second.departmentStatusMeta).toBe(first.departmentStatusMeta)
    expect(second.contactStatusMeta).toBe(first.contactStatusMeta)
    expect(second.statuses).toBe(first.statuses)
  })

  // LOOKUPSEED-EXISTS-1: the hook hands its own i18n checker to the seed translation as the fourth argument.
  it('passes the caller i18n checker to translateSeedList for every family', () => {
    renderHook(() => useCustomerLookups())
    for (const family of ['customerStatuses', 'subStatuses']) {
      expect(translateSeedList).toHaveBeenCalledWith(stableT, family, expect.any(Array), stableI18n)
    }
  })

  it('resolves a known value to its row and an unknown one to the neutral fallback', () => {
    const { result } = renderHook(() => useCustomerLookups())
    expect(result.current.statusMeta('active')).toEqual(DATA.statuses[0])
    const unknown = result.current.statusMeta('nope')
    expect(unknown).toMatchObject({ value: 'nope', label: 'nope' })
    expect(unknown.color).toBeTruthy()
    expect(result.current.statusMeta(null).label).toBe('—')
    expect(result.current.loading).toBe(false)
  })
})
