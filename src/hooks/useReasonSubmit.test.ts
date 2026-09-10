/**
 * useReasonSubmit — the shared guard/success/422 submit flow the match reason
 * modals (Renew/Terminate) both use. Behaviour tests, not "renders".
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const notifySuccess = vi.fn()
const notifyError = vi.fn()
vi.mock('@/lib/notify', () => ({ notifySuccess: (...a: unknown[]) => notifySuccess(...a), notifyError: (...a: unknown[]) => notifyError(...a) }))

afterEach(() => { vi.clearAllMocks() })

describe('useReasonSubmit', () => {
  it('does not call the action when canSubmit is false', async () => {
    const { useReasonSubmit } = await import('./useReasonSubmit')
    const action = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const { result } = renderHook(() => useReasonSubmit({ canSubmit: false, action, successMessage: 'ok', errorMessage: 'err', onClose }))
    await act(async () => { await result.current.submit() })
    expect(action).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('on success: calls the action, notifies success, and closes', async () => {
    const { useReasonSubmit } = await import('./useReasonSubmit')
    const action = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    const { result } = renderHook(() => useReasonSubmit({ canSubmit: true, action, successMessage: 'ok', errorMessage: 'err', onClose }))
    await act(async () => { await result.current.submit() })
    expect(action).toHaveBeenCalledTimes(1)
    expect(notifySuccess).toHaveBeenCalledWith('ok')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('on a 422 with field errors: sets fieldErrors and shows NO generic toast', async () => {
    const { useReasonSubmit } = await import('./useReasonSubmit')
    const action = vi.fn().mockRejectedValue({ response: { data: { errors: { stop_reason: ['Required'] } } } })
    const onClose = vi.fn()
    const { result } = renderHook(() => useReasonSubmit({ canSubmit: true, action, successMessage: 'ok', errorMessage: 'err', onClose }))
    await act(async () => { await result.current.submit() })
    expect(result.current.fieldErrors).toEqual({ stop_reason: 'Required' })
    expect(notifyError).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  // HEAD's exact branch: an EMPTY errors object is still a field-error response —
  // clears fieldErrors, shows no toast (mirrors extractFormErrorsWithMessages' null-vs-{} contract).
  it('on a 422 with an empty errors object: clears fieldErrors and shows NO toast', async () => {
    const { useReasonSubmit } = await import('./useReasonSubmit')
    const action = vi.fn().mockRejectedValue({ response: { data: { errors: {} } } })
    const onClose = vi.fn()
    const { result } = renderHook(() => useReasonSubmit({ canSubmit: true, action, successMessage: 'ok', errorMessage: 'err', onClose }))
    await act(async () => { await result.current.submit() })
    expect(result.current.fieldErrors).toEqual({})
    expect(notifyError).not.toHaveBeenCalled()
    expect(notifySuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('on a non-422 error (no errors key): shows a generic toast, no fieldErrors', async () => {
    const { useReasonSubmit } = await import('./useReasonSubmit')
    const action = vi.fn().mockRejectedValue({ response: { status: 500, data: {} } })
    const onClose = vi.fn()
    const { result } = renderHook(() => useReasonSubmit({ canSubmit: true, action, successMessage: 'ok', errorMessage: 'err', onClose }))
    await act(async () => { await result.current.submit() })
    expect(result.current.fieldErrors).toEqual({})
    expect(notifyError).toHaveBeenCalledWith('err')
    expect(onClose).not.toHaveBeenCalled()
  })
})
