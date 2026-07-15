import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useActionRulePreflight } from './useActionRulePreflight'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

describe('useActionRulePreflight', () => {
  beforeEach(() => { mockGet.mockReset() })

  // No subject yet (form still being filled) — must not fire a request at all.
  it('does nothing without a candidateId or customerId', () => {
    renderHook(() => useActionRulePreflight('task.create', {}))
    expect(mockGet).not.toHaveBeenCalled()
  })

  // Happy path: resolves the decision and passes the right query params.
  it('fetches the decision for a candidate subject', async () => {
    mockGet.mockResolvedValue({ data: { effect: 'warn', popup_code: 'P3', message: 'Kandidaat is niet beschikbaar.' } })
    const { result } = renderHook(() => useActionRulePreflight('task.create', { candidateId: 'c1' }))
    await waitFor(() => expect(result.current.decision).not.toBeNull())
    expect(result.current.decision).toEqual({ effect: 'warn', popup_code: 'P3', message: 'Kandidaat is niet beschikbaar.' })
    expect(mockGet).toHaveBeenCalledWith('/action-rules/preflight',
      expect.objectContaining({ params: { action: 'task.create', candidate_id: 'c1' } }))
  })

  // Session cache: a second hook for the SAME action+subject must not re-fetch.
  it('caches by action+subject — a second mount reuses the in-flight/resolved call', async () => {
    mockGet.mockResolvedValue({ data: { effect: 'allow' } })
    const { result: a } = renderHook(() => useActionRulePreflight('whatsapp.send', { candidateId: 'c9' }))
    await waitFor(() => expect(a.current.decision).not.toBeNull())
    const { result: b } = renderHook(() => useActionRulePreflight('whatsapp.send', { candidateId: 'c9' }))
    await waitFor(() => expect(b.current.decision).not.toBeNull())
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  // A different subject is a different cache key — always a fresh request.
  it('fetches again for a different subject id', async () => {
    mockGet.mockResolvedValue({ data: { effect: 'allow' } })
    const { result: a } = renderHook(() => useActionRulePreflight('match.create', { candidateId: 'c1' }))
    await waitFor(() => expect(a.current.decision).not.toBeNull())
    const { result: b } = renderHook(() => useActionRulePreflight('match.create', { candidateId: 'c2' }))
    await waitFor(() => expect(b.current.decision).not.toBeNull())
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  // A customer subject sends customer_id, never candidate_id.
  it('fetches for a customer subject via customer_id', async () => {
    mockGet.mockResolvedValue({ data: { effect: 'block', popup_code: 'P8', message: 'Geen toestemming.' } })
    const { result } = renderHook(() => useActionRulePreflight('customer.match', { customerId: 'k1' }))
    await waitFor(() => expect(result.current.decision).not.toBeNull())
    expect(mockGet).toHaveBeenCalledWith('/action-rules/preflight',
      expect.objectContaining({ params: { action: 'customer.match', customer_id: 'k1' } }))
  })

  // A failed fetch surfaces `error` and evicts the cache so a later retry can succeed.
  it('surfaces an error and evicts the cache entry on failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'))
    const { result } = renderHook(() => useActionRulePreflight('task.create', { candidateId: 'c-fail' }))
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.decision).toBeNull()

    mockGet.mockResolvedValueOnce({ data: { effect: 'allow' } })
    const { result: retry } = renderHook(() => useActionRulePreflight('task.create', { candidateId: 'c-fail' }))
    await waitFor(() => expect(retry.current.decision).not.toBeNull())
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  // A 403 means the caller's role lacks the axis view-right (BE audit 15-07) — that
  // is NOT a preflight error: no decision (so no popup/banner renders), no error
  // flag, and — unlike a generic failure — the outcome stays cached (the role
  // won't change mid-session, so a second mount must not re-fetch).
  it('treats a 403 as "no decision" — silent, not an error, and cached', async () => {
    mockGet.mockRejectedValueOnce({ response: { status: 403 } })
    const { result: a } = renderHook(() => useActionRulePreflight('match.create', { candidateId: 'c-403' }))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))
    expect(a.current.decision).toBeNull()
    expect(a.current.error).toBe(false)

    const { result: b } = renderHook(() => useActionRulePreflight('match.create', { candidateId: 'c-403' }))
    await waitFor(() => expect(b.current.loading).toBe(false))
    expect(b.current.decision).toBeNull()
    expect(b.current.error).toBe(false)
    // Cached — the second mount must not have issued a new request.
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})
