/**
 * useDuplicateProbe.test — the control-round gap of 13-08: nothing asserted the
 * REAL seam. This does: the probe POSTs to /candidates/check-duplicate with the
 * fields in the BODY (§7 — never a query string), debounced, and every input
 * change clears the previous verdict.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useDuplicateProbe } from './useDuplicateProbe'

vi.mock('@/lib/api', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: { exists: true, match: { id: 'c1', name: 'Noud Blom' } } }) },
}))

describe('useDuplicateProbe · the POST seam', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('POSTs route + BODY (never a query string) after the debounce, and surfaces the match', async () => {
    const { result } = renderHook(({ email }) => useDuplicateProbe(email, '', ''), {
      initialProps: { email: 'danny@yesway.nl' },
    })
    expect(api.post).not.toHaveBeenCalled() // debounce still pending
    await act(async () => { vi.runOnlyPendingTimers() })
    expect(api.post).toHaveBeenCalledWith(
      '/candidates/check-duplicate',
      { email: 'danny@yesway.nl', mobile: undefined, phone: undefined },
      expect.objectContaining({ signal: expect.anything() }),
    )
    vi.useRealTimers() // let the resolved promise flush
    await waitFor(() => expect(result.current.probeMatch).toEqual({ id: 'c1', name: 'Noud Blom' }))
  })

  it('clears the verdict the moment any input changes', async () => {
    const { result, rerender } = renderHook(({ email }) => useDuplicateProbe(email, '', ''), {
      initialProps: { email: 'danny@yesway.nl' },
    })
    await act(async () => { vi.runOnlyPendingTimers() })
    vi.useRealTimers()
    await waitFor(() => expect(result.current.probeMatch).not.toBeNull())
    vi.useFakeTimers()
    // Editing invalidates the on-screen answer immediately — before any new probe.
    act(() => rerender({ email: 'danny@yesway.n' }))
    expect(result.current.probeMatch).toBeNull()
  })

  it('asks nothing while all three probe fields are empty', async () => {
    renderHook(() => useDuplicateProbe('', '', ''))
    await act(async () => { vi.runAllTimers() })
    expect(api.post).not.toHaveBeenCalled()
  })
})
