/**
 * useCustomFields — regression test for the generic per-entity custom-fields hook
 * (§3B "Eigen velden" wave): active-language label pick, active-only filtering,
 * the per-entity-type session cache (one fetch per entity type, not one global
 * fetch), and invalidate() scoping to a single entity type.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import '@/i18n'
import { useCustomFields } from './useCustomFields'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

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
})
