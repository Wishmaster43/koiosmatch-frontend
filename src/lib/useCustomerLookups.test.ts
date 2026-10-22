import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCustomerLookups } from './useCustomerLookups'

// One stable `t` for the whole suite: a fresh function per render would defeat the memos under test.
const stableT = vi.hoisted(() => (k: string) => k)
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: stableT }) }))
// The seed translation is not under test: pass the rows through unchanged.
vi.mock('./lookupSeedI18n', () => ({ translateSeedList: (_t: unknown, _k: string, list: unknown) => list }))
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
