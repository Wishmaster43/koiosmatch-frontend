/**
 * useOptimisticList — the shared "load once, keep in sync with optimistic
 * add/patch/drop" hook (API keys / webhook subscriptions). Asserts: the
 * optimistic row is visible immediately (before any refetch resolves);
 * refetchOnAdd/refetchOnPatch drive a real re-fetch when true, never when
 * false; and a triggered refetch reconciles the optimistic row with the
 * server's own version once it resolves.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOptimisticList } from './useOptimisticList'

interface Row { id: string; name: string }

describe('useOptimisticList · load', () => {
  it('fetches once on mount and exposes the rows', async () => {
    const fetchList = vi.fn().mockResolvedValue({ rows: [{ id: '1', name: 'A' }] })
    const { result } = renderHook(() => useOptimisticList<Row>(fetchList))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toEqual([{ id: '1', name: 'A' }])
    expect(fetchList).toHaveBeenCalledTimes(1)
  })
})

describe('useOptimisticList · add', () => {
  it('shows the optimistic row immediately, and refetches only when refetchOnAdd is true', async () => {
    const fetchList = vi.fn().mockResolvedValue({ rows: [] })
    const { result } = renderHook(() => useOptimisticList<Row>(fetchList, { refetchOnAdd: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchList).toHaveBeenCalledTimes(1)

    act(() => { result.current.add({ id: '2', name: 'New' }) })
    // Present right away, before the refetch it triggers has resolved.
    expect(result.current.items).toEqual([{ id: '2', name: 'New' }])
    await waitFor(() => expect(fetchList).toHaveBeenCalledTimes(2))
  })

  it('never refetches when refetchOnAdd is false (the default)', async () => {
    const fetchList = vi.fn().mockResolvedValue({ rows: [] })
    const { result } = renderHook(() => useOptimisticList<Row>(fetchList))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.add({ id: '3', name: 'New' }) })
    expect(result.current.items).toEqual([{ id: '3', name: 'New' }])
    expect(fetchList).toHaveBeenCalledTimes(1)
  })
})

describe('useOptimisticList · patch', () => {
  it('applies the patch immediately, and refetches only when refetchOnPatch is true', async () => {
    const fetchList = vi.fn().mockResolvedValue({ rows: [{ id: '1', name: 'A' }] })
    const { result } = renderHook(() => useOptimisticList<Row>(fetchList, { refetchOnPatch: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchList).toHaveBeenCalledTimes(1)

    act(() => { result.current.patch('1', { name: 'A2' }) })
    expect(result.current.items).toEqual([{ id: '1', name: 'A2' }])
    await waitFor(() => expect(fetchList).toHaveBeenCalledTimes(2))
  })

  it('never refetches when refetchOnPatch is false (the default)', async () => {
    const fetchList = vi.fn().mockResolvedValue({ rows: [{ id: '1', name: 'A' }] })
    const { result } = renderHook(() => useOptimisticList<Row>(fetchList))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.patch('1', { name: 'A2' }) })
    expect(result.current.items).toEqual([{ id: '1', name: 'A2' }])
    expect(fetchList).toHaveBeenCalledTimes(1)
  })
})

describe('useOptimisticList · reconciliation', () => {
  it('reconciles the optimistic row with the server row once the triggered refetch resolves', async () => {
    const fetchList = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '2', name: 'Server Name' }] })
    const { result } = renderHook(() => useOptimisticList<Row>(fetchList, { refetchOnAdd: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.add({ id: '2', name: 'Optimistic Name' }) })
    expect(result.current.items).toEqual([{ id: '2', name: 'Optimistic Name' }])

    await waitFor(() => expect(result.current.items).toEqual([{ id: '2', name: 'Server Name' }]))
  })
})
