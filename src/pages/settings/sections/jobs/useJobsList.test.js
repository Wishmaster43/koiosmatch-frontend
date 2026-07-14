/**
 * useJobsList — covers the Taakbeheer "Taken" tab's core behaviour: filters reset
 * pagination, a successful cancel reloads the list, and a 409 (the job got
 * reserved by a worker between render and click) surfaces the backend's own
 * message instead of a generic error.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useJobsList } from './useJobsList'
import { fetchJobsList, cancelJob } from './jobsApi'

vi.mock('./jobsApi', () => ({ fetchJobsList: vi.fn(), cancelJob: vi.fn() }))

// Mimics the raw axios response `unwrapList` expects: res.data = the Laravel paginator envelope.
const page = (rows, over = {}) => ({ data: { data: rows, total: rows.length, current_page: 1, last_page: 1, per_page: 25, ...over } })

afterEach(() => vi.clearAllMocks())

describe('useJobsList', () => {
  it('loads page 1 with empty filters on mount', async () => {
    vi.mocked(fetchJobsList).mockResolvedValue(page([{ id: 1, queue: 'default' }]))
    const { result } = renderHook(() => useJobsList())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(fetchJobsList).toHaveBeenCalledWith({ page: 1, per_page: 25 }, expect.anything())
    expect(result.current.result.rows).toHaveLength(1)
  })

  it('setFilter resets the page back to 1', async () => {
    vi.mocked(fetchJobsList).mockResolvedValue(page([]))
    const { result } = renderHook(() => useJobsList())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    act(() => result.current.setPage(3))
    await waitFor(() => expect(fetchJobsList).toHaveBeenLastCalledWith({ page: 3, per_page: 25 }, expect.anything()))
    act(() => result.current.setFilter('queue', 'wa_send'))
    await waitFor(() => expect(fetchJobsList).toHaveBeenLastCalledWith({ page: 1, per_page: 25, queue: 'wa_send' }, expect.anything()))
  })

  it('cancel() reloads the list on success', async () => {
    vi.mocked(fetchJobsList).mockResolvedValue(page([{ id: 7 }]))
    vi.mocked(cancelJob).mockResolvedValue({ data: { message: 'ok' } })
    const { result } = renderHook(() => useJobsList())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    const callsBefore = vi.mocked(fetchJobsList).mock.calls.length
    await act(async () => { await result.current.cancel(7) })
    expect(cancelJob).toHaveBeenCalledWith(7)
    expect(vi.mocked(fetchJobsList).mock.calls.length).toBeGreaterThan(callsBefore)
    expect(result.current.cancelError).toBeNull()
  })

  it('cancel() surfaces the 409 message when the job is already reserved', async () => {
    vi.mocked(fetchJobsList).mockResolvedValue(page([{ id: 9 }]))
    vi.mocked(cancelJob).mockRejectedValue({ response: { status: 409, data: { message: 'Job is momenteel in behandeling.' } } })
    const { result } = renderHook(() => useJobsList())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    await act(async () => { await result.current.cancel(9) })
    expect(result.current.cancelError).toEqual({ id: 9, message: 'Job is momenteel in behandeling.' })
  })
})
