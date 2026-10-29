/**
 * useCvParse.test — error mapping on the parse request and the poll: the storage 503 is told
 * apart by its body code, a bare 503 is "unavailable", 413 is "too large".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const postMock = vi.fn()
const getMock = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { post: (...a: unknown[]) => postMock(...a), get: (...a: unknown[]) => getMock(...a) },
  unwrap: (r: { data?: unknown }) => r?.data,
}))

import { useCvParse } from './useCvParse'

const file = () => new File(['x'], 'cv.pdf', { type: 'application/pdf' })
const reject = (status: number, data?: unknown) => ({ response: { status, data } })

describe('useCvParse error mapping', () => {
  beforeEach(() => { postMock.mockReset(); getMock.mockReset() })

  it('maps a storage_unavailable 503 on the parse POST to the storage message and asserts the request', async () => {
    postMock.mockRejectedValueOnce(reject(503, { code: 'storage_unavailable' }))
    const { result } = renderHook(() => useCvParse({ onReady: vi.fn() }))
    await act(async () => { await result.current.start(file()) })
    expect(postMock.mock.calls[0][0]).toBe('/candidates/parse-cv')
    expect(result.current.errorKey).toBe('modal.cv.error.storageUnavailable')
  })

  it('maps a bare 503 to unavailable, never to the storage message', async () => {
    postMock.mockRejectedValueOnce(reject(503))
    const { result } = renderHook(() => useCvParse({ onReady: vi.fn() }))
    await act(async () => { await result.current.start(file()) })
    expect(result.current.errorKey).toBe('modal.cv.error.unavailable')
  })

  it('maps a bare 503 on the poll GET to unavailable', async () => {
    postMock.mockResolvedValueOnce({ data: { token: 'tok' } })
    getMock.mockRejectedValueOnce(reject(503))
    const { result } = renderHook(() => useCvParse({ onReady: vi.fn() }))
    await act(async () => { await result.current.start(file()) })
    expect(getMock.mock.calls[0][0]).toBe('/candidates/parse-cv/tok')
    expect(result.current.errorKey).not.toBe('modal.cv.error.storageUnavailable')
    expect(result.current.errorKey).toBe('modal.cv.error.unavailable')
  })

  it('maps 413 to tooLarge', async () => {
    postMock.mockRejectedValueOnce(reject(413))
    const { result } = renderHook(() => useCvParse({ onReady: vi.fn() }))
    await act(async () => { await result.current.start(file()) })
    expect(result.current.errorKey).toBe('modal.cv.error.tooLarge')
  })
})
