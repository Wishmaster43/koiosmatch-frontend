/**
 * useWebhookEventCatalog — asserts the GET /webhook-events route is called and
 * that the response is grouped correctly; asserts the bundled static catalogue
 * (webhookEvents.js) renders only when the request fails (SETTINGS-WEBHOOK-EVENTS-DUP-1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useWebhookEventCatalog } from './useWebhookEventCatalog'
import { ALL_EVENTS as FALLBACK_ALL_EVENTS, EVENT_GROUPS as FALLBACK_EVENT_GROUPS, actionOf } from './webhookEvents'
import api from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

// Typed mock handle so every `.mockResolvedValue(...)` call below is checked.
const mockedGet = vi.mocked(api.get)

describe('useWebhookEventCatalog', () => {
  it('fetches GET /webhook-events', async () => {
    mockedGet.mockResolvedValue({ data: { data: [
      { key: 'candidate.created', label: 'Candidate created', group: 'candidates', pii: false },
    ] } })
    const { result } = renderHook(() => useWebhookEventCatalog(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/webhook-events')
  })

  it('groups the flat response by `group`, preserving order', async () => {
    mockedGet.mockResolvedValue({ data: { data: [
      { key: 'candidate.created', label: 'Candidate created', group: 'candidates', pii: false },
      { key: 'candidate.updated', label: 'Candidate updated', group: 'candidates', pii: false },
      { key: 'match.created', label: 'Match created', group: 'matches', pii: false },
    ] } })
    const { result } = renderHook(() => useWebhookEventCatalog(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.groups).toEqual([
      { group: 'candidates', events: ['candidate.created', 'candidate.updated'] },
      { group: 'matches', events: ['match.created'] },
    ])
    expect(result.current.isFallback).toBe(false)
  })

  it('an event key the static list lacks is still selectable (server is the live source of truth)', async () => {
    mockedGet.mockResolvedValue({ data: { data: [
      { key: 'candidate.brand_new_signal', label: 'Brand new signal', group: 'candidates', pii: false },
    ] } })
    const { result } = renderHook(() => useWebhookEventCatalog(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.groups.flatMap((g) => g.events)).toContain('candidate.brand_new_signal')
  })

  it('every server event across all 66 keys / 14 groups is reachable (checklist item 4)', async () => {
    // Built from the fallback file's own 66 keys/14 groups as the known-good shape
    // (webhookEvents.test.js guards that shape against the backend separately) —
    // here we only assert the LIVE hook reproduces it faithfully from a full response.
    const fullResponse = FALLBACK_EVENT_GROUPS.flatMap(({ group, events }) =>
      events.map((key) => ({ key, label: actionOf(key), group, pii: false })))
    mockedGet.mockResolvedValue({ data: { data: fullResponse } })
    const { result } = renderHook(() => useWebhookEventCatalog(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isFallback).toBe(false)
    expect(result.current.groups.map((g) => g.group)).toEqual(FALLBACK_EVENT_GROUPS.map((g) => g.group))
    expect(result.current.groups.flatMap((g) => g.events)).toEqual(FALLBACK_ALL_EVENTS)
    expect(result.current.groups.flatMap((g) => g.events)).toHaveLength(66)
    expect(result.current.groups).toHaveLength(14)
  })

  it('falls back to the bundled static catalogue on a network error, flagged via isFallback', async () => {
    mockedGet.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useWebhookEventCatalog(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.isFallback).toBe(true)
    expect(result.current.groups.flatMap((g) => g.events)).toEqual(FALLBACK_ALL_EVENTS)
  })
})
