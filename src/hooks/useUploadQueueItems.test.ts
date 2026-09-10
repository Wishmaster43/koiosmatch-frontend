import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUploadQueueItems } from './useUploadQueueItems'

// Minimal item shape used by every test below.
interface TestItem { objectUrl: string; type: string; name: string; linkTo?: string }

describe('useUploadQueueItems', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('setItemType updates only the targeted item', () => {
    const { result } = renderHook(() => useUploadQueueItems<TestItem>([
      { objectUrl: 'blob:a', type: 'CV', name: 'a.pdf' },
      { objectUrl: 'blob:b', type: 'CV', name: 'b.pdf' },
    ]))
    act(() => result.current.setItemType(1, 'ID'))
    expect(result.current.pending[0].type).toBe('CV')
    expect(result.current.pending[1].type).toBe('ID')
  })

  it('setAllTypes gives every queued item the same type', () => {
    const { result } = renderHook(() => useUploadQueueItems<TestItem>([
      { objectUrl: 'blob:a', type: 'CV', name: 'a.pdf' },
      { objectUrl: 'blob:b', type: 'ID', name: 'b.pdf' },
    ]))
    act(() => result.current.setAllTypes('Diploma'))
    expect(result.current.pending.map(it => it.type)).toEqual(['Diploma', 'Diploma'])
  })

  it('setItemLink updates only the targeted item link pick', () => {
    const { result } = renderHook(() => useUploadQueueItems<TestItem>([
      { objectUrl: 'blob:a', type: 'CV', name: 'a.pdf', linkTo: '' },
      { objectUrl: 'blob:b', type: 'CV', name: 'b.pdf', linkTo: '' },
    ]))
    act(() => result.current.setItemLink(0, 'education:5'))
    expect(result.current.pending[0].linkTo).toBe('education:5')
    expect(result.current.pending[1].linkTo).toBe('')
  })

  it('removePending revokes the correct blob URL BEFORE the filtered array replaces state (HEAD order)', () => {
    const { result } = renderHook(() => useUploadQueueItems<TestItem>([
      { objectUrl: 'blob:a', type: 'CV', name: 'a.pdf' },
      { objectUrl: 'blob:b', type: 'CV', name: 'b.pdf' },
    ]))
    // At the moment revoke fires, `pending` must still hold BOTH items — proving
    // the revoke reads the pre-filter array, not the already-shrunk one.
    let pendingLengthAtRevokeTime = -1
    ;(URL.revokeObjectURL as ReturnType<typeof vi.fn>).mockImplementation(() => {
      pendingLengthAtRevokeTime = result.current.pending.length
    })

    act(() => result.current.removePending(0))

    expect(pendingLengthAtRevokeTime).toBe(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a')
    expect(result.current.pending).toEqual([{ objectUrl: 'blob:b', type: 'CV', name: 'b.pdf' }])
  })
})
