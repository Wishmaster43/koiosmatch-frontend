/** useLeadReceipts — asserts the real requests (route, params) and the retry row replacement. */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import { useLeadReceipts } from './useLeadReceipts'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
const mocked = vi.mocked(api, true)
const row = (id: number, status = 'pending') => ({ id, form_id: 'f1', status, attempts: 1, last_error_code: null, next_retry_at: null, escalated_at: null, retrieved_at: null, candidate_id: null, created_at: null })

function mockGets() {
  mocked.get.mockImplementation((url: string) => Promise.resolve(url.endsWith('/summary')
    ? { data: { data: { pending: 2, retrieved: 1, rejected: 0, failed: 0, oldest_pending_at: null } } }
    : { data: { data: [row(1), row(2)], meta: { total: 2, last_page: 1 } } }) as never)
}
afterEach(() => vi.clearAllMocks())

describe('useLeadReceipts', () => {
  it('requests receipts with status + per_page and the summary', async () => {
    mockGets()
    const { result } = renderHook(() => useLeadReceipts('pending'))
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    expect(mocked.get).toHaveBeenCalledWith('/facebook-leads/receipts', { params: { per_page: 25, page: 1, status: 'pending' } })
    expect(mocked.get).toHaveBeenCalledWith('/facebook-leads/receipts/summary')
    await waitFor(() => expect(result.current.summary?.pending).toBe(2))
  })

  it('omits status for the all filter', async () => {
    mockGets()
    const { result } = renderHook(() => useLeadReceipts(''))
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    expect(mocked.get).toHaveBeenCalledWith('/facebook-leads/receipts', { params: { per_page: 25, page: 1 } })
  })

  it('posts the retry and replaces the row with the response', async () => {
    mockGets()
    mocked.post.mockResolvedValue({ data: { data: row(1, 'retrieved') } })
    const { result } = renderHook(() => useLeadReceipts('pending'))
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    await act(async () => { await result.current.retry(1) })
    expect(mocked.post).toHaveBeenCalledWith('/facebook-leads/receipts/1/retry')
    expect(result.current.rows[0].status).toBe('retrieved')
    await waitFor(() => expect(mocked.get.mock.calls.filter((c) => c[0] === '/facebook-leads/receipts/summary')).toHaveLength(2))
  })

  it('shows a message for 422 lead_already_retrieved', async () => {
    mockGets()
    mocked.post.mockRejectedValue({ response: { status: 422, data: { code: 'lead_already_retrieved' } } })
    const { result } = renderHook(() => useLeadReceipts('pending'))
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    await act(async () => { await result.current.retry(1) })
    expect(result.current.retryError).toBe(i18n.t('facebookLeads.queue.alreadyRetrieved', { ns: 'settings' }))
    expect(result.current.rows[0].status).toBe('pending')
  })

  // CONTRACT-FOLLOW-1: a fetch job for the lead is in flight -> 409 lead_in_flight has its own sentence.
  it('shows the in-flight sentence for 409 lead_in_flight', async () => {
    mockGets()
    mocked.post.mockRejectedValue({ response: { status: 409, data: { code: 'lead_in_flight', message: 'raw' } } })
    const { result } = renderHook(() => useLeadReceipts('pending'))
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    await act(async () => { await result.current.retry(1) })
    expect(mocked.post).toHaveBeenCalledWith('/facebook-leads/receipts/1/retry')
    expect(result.current.retryError).toBe(i18n.t('facebookLeads.queue.retryInFlight', { ns: 'settings' }))
  })

  it('never sends a blank status param for the all filter', async () => {
    mockGets()
    renderHook(() => useLeadReceipts(''))
    await waitFor(() => expect(mocked.get).toHaveBeenCalledWith('/facebook-leads/receipts', { params: { per_page: 25, page: 1 } }))
  })

  it('shows the generic retry failure text for other errors', async () => {
    mockGets()
    mocked.post.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useLeadReceipts('pending'))
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    await act(async () => { await result.current.retry(1) })
    expect(result.current.retryError).toBe(i18n.t('facebookLeads.queue.retryFailed', { ns: 'settings' }))
    expect(result.current.rows[0].status).toBe('pending')
    expect(mocked.post).toHaveBeenCalledWith('/facebook-leads/receipts/1/retry')
  })

  // A raw Laravel message (404/500) must never reach the user: only the translated fallback shows.
  it.each([
    [404, 'No query results for model [App\\Models\\FacebookLeadReceipt] x'],
    [500, 'Server Error'],
  ])('maps a %i response to the translated retry failure, not the server message', async (status, message) => {
    mockGets()
    mocked.post.mockRejectedValue({ response: { status, data: { message } } })
    const { result } = renderHook(() => useLeadReceipts('pending'))
    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    await act(async () => { await result.current.retry(1) })
    expect(result.current.retryError).toBe(i18n.t('facebookLeads.queue.retryFailed', { ns: 'settings' }))
  })

  it('reports a failed summary request without touching the receipts', async () => {
    mocked.get.mockImplementation((url: string) => (url.endsWith('/summary')
      ? Promise.reject(new Error('x'))
      : Promise.resolve({ data: { data: [row(1)], meta: { total: 1, last_page: 1 } } })) as never)
    const { result } = renderHook(() => useLeadReceipts('pending'))
    await waitFor(() => expect(result.current.summaryError).toBe(true))
    expect(result.current.summary).toBeNull()
    expect(result.current.error).toBe(false)
    expect(result.current.rows).toHaveLength(1)
  })
})
