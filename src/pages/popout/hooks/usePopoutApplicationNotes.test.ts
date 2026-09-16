/**
 * usePopoutApplicationNotes — asserts the exact REQUEST (§13): the application
 * GET on mount (notes ride along in the payload), the add-note POST route, and
 * the §9 freshness guard (a stale in-flight response must never overwrite a
 * newer one's result) plus the §8 honest error flag.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePopoutApplicationNotes } from './usePopoutApplicationNotes'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>
const apiPost = api.post as unknown as ReturnType<typeof vi.fn>

describe('usePopoutApplicationNotes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the notes off the application payload on mount', async () => {
    apiGet.mockResolvedValue({ data: { data: { notes: [{ id: 'n1', type: 'general', text: 'Hello', author: 'Anne' }] } } })
    const { result } = renderHook(() => usePopoutApplicationNotes('app-1'))
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(apiGet).toHaveBeenCalledWith('/applications/app-1')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('never fetches without an applicationId', () => {
    renderHook(() => usePopoutApplicationNotes(undefined))
    expect(apiGet).not.toHaveBeenCalled()
  })

  // §8: a failed load surfaces as an honest error flag, never a silent empty list.
  it('sets error (not just an empty list) when the GET fails, and clears it on a successful reload', async () => {
    apiGet.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => usePopoutApplicationNotes('app-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
    expect(result.current.notes).toHaveLength(0)

    apiGet.mockResolvedValueOnce({ data: { data: { notes: [{ id: 'n1', type: 'general', text: 'Hello' }] } } })
    act(() => { result.current.reload() })
    await waitFor(() => expect(result.current.notes).toHaveLength(1))
    expect(result.current.error).toBe(false)
  })

  // §9: a slower FIRST response landing after a faster SECOND one must never win.
  it('discards a stale response that resolves after a newer reload', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    apiGet.mockImplementationOnce(() => new Promise(res => { resolveFirst = res }))
    const { result } = renderHook(() => usePopoutApplicationNotes('app-1'))

    apiGet.mockResolvedValueOnce({ data: { data: { notes: [{ id: 'n2', type: 'general', text: 'Fresh' }] } } })
    act(() => { result.current.reload() })
    await waitFor(() => expect(result.current.notes).toHaveLength(1))

    // The stale first request now resolves — it must not overwrite the fresh result.
    act(() => { resolveFirst({ data: { data: { notes: [{ id: 'n1', type: 'general', text: 'Stale' }] } } }) })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.notes).toEqual([expect.objectContaining({ id: 'n2', text: 'Fresh' })])
  })

  it('posts the exact add-note request and reloads on success', async () => {
    apiGet.mockResolvedValue({ data: { data: { notes: [] } } })
    apiPost.mockResolvedValue({ data: { data: {} } })
    const { result } = renderHook(() => usePopoutApplicationNotes('app-1'))
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    act(() => { result.current.addNote({ type: 'general', title: '', body: 'A new note', language: 'nl' }) })
    expect(result.current.notes[0]).toMatchObject({ type: 'general', text: 'A new note' })
    expect(apiPost).toHaveBeenCalledWith('/applications/app-1/notes', { type: 'general', title: '', body: 'A new note', language: 'nl' })
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2))
  })

  it('reverts the optimistic note and surfaces an error toast when the POST fails', async () => {
    apiGet.mockResolvedValue({ data: { data: { notes: [] } } })
    apiPost.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => usePopoutApplicationNotes('app-1'))
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1))

    act(() => { result.current.addNote({ type: 'general', title: '', body: 'Doomed note' }) })
    expect(result.current.notes).toHaveLength(1)
    await waitFor(() => expect(result.current.notes).toHaveLength(0))
    expect(notifyError).toHaveBeenCalledTimes(1)
  })
})
