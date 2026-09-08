import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useLiteRecord } from './useLiteRecord'

describe('useLiteRecord', () => {
  it('loads and maps on mount and exposes the record', async () => {
    const mockData = { id: '123', name: 'Test Record' }
    const fetchRecord = vi.fn().mockResolvedValue(mockData)

    const { result } = renderHook(() => useLiteRecord('123', fetchRecord))

    // Initial loading state
    expect(result.current.loading).toBe(true)
    expect(result.current.record).toBe(null)
    expect(result.current.error).toBe(false)

    // After fetch completes
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.record).toEqual(mockData)
    expect(result.current.error).toBe(false)
    expect(fetchRecord).toHaveBeenCalledWith('123')
  })

  it('no id => loading false and no fetch', () => {
    const fetchRecord = vi.fn()

    const { result } = renderHook(() => useLiteRecord(undefined, fetchRecord))

    expect(result.current.loading).toBe(false)
    expect(result.current.record).toBe(null)
    expect(result.current.error).toBe(false)
    expect(fetchRecord).not.toHaveBeenCalled()
  })

  it('rejected fetch => error true, loading false', async () => {
    const fetchRecord = vi.fn().mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useLiteRecord('123', fetchRecord))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe(true)
    expect(result.current.record).toBe(null)
  })

  it('reload refetches', async () => {
    const mockData1 = { id: '123', name: 'First' }
    const mockData2 = { id: '123', name: 'Second' }
    const fetchRecord = vi.fn()
      .mockResolvedValueOnce(mockData1)
      .mockResolvedValueOnce(mockData2)

    const { result } = renderHook(() => useLiteRecord('123', fetchRecord))

    await waitFor(() => {
      expect(result.current.record).toEqual(mockData1)
    })

    result.current.reload()

    await waitFor(() => {
      expect(result.current.record).toEqual(mockData2)
    })

    expect(fetchRecord).toHaveBeenCalledTimes(2)
  })
})
