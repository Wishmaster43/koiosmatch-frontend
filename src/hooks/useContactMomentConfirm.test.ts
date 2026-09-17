/**
 * useContactMomentConfirm (shared) behaviour test (§16 SHARED-UNIT-TEST-1) —
 * asserts the entity-agnostic confirm flow directly: prompt/dismiss/confirm
 * state, the exact POST built from buildPath, the server-stamp pass-through,
 * and the 422 fallback-message path, all independent of any entity wiring.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useContactMomentConfirm } from './useContactMomentConfirm'

const mockPost = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: (...args: unknown[]) => mockPost(...args), patch: vi.fn(), delete: vi.fn() } }
})

const mockNotifyError = vi.fn()
vi.mock('@/lib/notify', async () => {
  const actual = await vi.importActual('@/lib/notify')
  return { ...actual, notifyError: (...args: unknown[]) => mockNotifyError(...args) }
})

beforeEach(() => { mockPost.mockReset(); mockNotifyError.mockReset() })
afterEach(() => vi.clearAllMocks())

const buildPath = (id: string | number) => `/things/${id}/contact-moments`

describe('useContactMomentConfirm (shared)', () => {
  it('prompt opens the pending channel, dismiss clears it without firing a request', () => {
    const { result } = renderHook(() => useContactMomentConfirm('t1', buildPath, 'fallback'))
    expect(result.current.pending).toBeNull()
    act(() => result.current.prompt('email'))
    expect(result.current.pending).toBe('email')
    act(() => result.current.dismiss())
    expect(result.current.pending).toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('confirm POSTs the exact route+body from buildPath and hands the server stamp to onStamped', async () => {
    mockPost.mockResolvedValue({ data: { data: { last_contact_at: '2026-09-17T10:00:00Z', last_contact_type: 'email' } } })
    const onStamped = vi.fn()
    const { result } = renderHook(() => useContactMomentConfirm('t1', buildPath, 'fallback', onStamped))
    act(() => result.current.prompt('email'))
    await act(async () => { await result.current.confirm() })
    expect(mockPost).toHaveBeenCalledWith('/things/t1/contact-moments', { channel: 'email' })
    expect(onStamped).toHaveBeenCalledWith({ last_contact_at: '2026-09-17T10:00:00Z', last_contact_type: 'email' })
    expect(result.current.pending).toBeNull()
  })

  it('confirm without a pending channel or an entityId never fires a request', async () => {
    const { result } = renderHook(() => useContactMomentConfirm(undefined, buildPath, 'fallback'))
    await act(async () => { await result.current.confirm() })
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('a 422 shows the SERVER message via extractApiError, keeps pending set, never stamps', async () => {
    mockPost.mockRejectedValue({ response: { status: 422, data: { message: 'Server says no' } } })
    const onStamped = vi.fn()
    const { result } = renderHook(() => useContactMomentConfirm('t1', buildPath, 'fallback', onStamped))
    act(() => result.current.prompt('email'))
    await act(async () => { await result.current.confirm() })
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalledWith('Server says no'))
    expect(onStamped).not.toHaveBeenCalled()
    expect(result.current.pending).toBe('email')
  })
})
