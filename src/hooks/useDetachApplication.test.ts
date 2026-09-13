/**
 * useDetachApplication — asserts the REQUEST (§13: method/route/body, never
 * only that a callback fired): DELETE /applications/{id} with the required
 * {reason} body (measured live 08-08: 422 without it), the success toast +
 * onDone callback, and the error toast on a rejected DELETE (non-optimistic —
 * a 422/403 must never look like it succeeded).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDetachApplication } from './useDetachApplication'
import api from '@/lib/api'
import { notifySuccess, notifyError } from '@/lib/notify'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const mockDelete = api.delete as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { vi.clearAllMocks() })

describe('useDetachApplication', () => {
  it('DELETEs /applications/{id} with the {reason} body, toasts success and calls onDone', async () => {
    mockDelete.mockResolvedValue({})
    const onDone = vi.fn()
    const { result } = renderHook(() => useDetachApplication({ getId: () => 'app-1', doneLabel: 'Detached', onDone }))

    await act(async () => { await result.current.detachApplication('no longer needed', 'Detach failed') })

    expect(mockDelete).toHaveBeenCalledWith('/applications/app-1', { data: { reason: 'no longer needed' } })
    expect(notifySuccess).toHaveBeenCalledWith('Detached')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(result.current.detaching).toBe(false)
  })

  it('toasts the extracted server error and never calls onDone on a failed DELETE', async () => {
    mockDelete.mockRejectedValue({ response: { data: { message: 'Cannot detach' } } })
    const onDone = vi.fn()
    const { result } = renderHook(() => useDetachApplication({ getId: () => 'app-1', doneLabel: 'Detached', onDone }))

    await act(async () => { await result.current.detachApplication('reason', 'Detach failed') })

    expect(notifyError).toHaveBeenCalledWith('Cannot detach')
    expect(onDone).not.toHaveBeenCalled()
    expect(result.current.detaching).toBe(false)
  })

  it('sends nothing when getId returns null/undefined', async () => {
    const onDone = vi.fn()
    const { result } = renderHook(() => useDetachApplication({ getId: () => null, doneLabel: 'Detached', onDone }))

    await act(async () => { await result.current.detachApplication('reason', 'fail') })

    expect(mockDelete).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
