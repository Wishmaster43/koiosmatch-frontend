/**
 * useLastContactTypes — LAATSTE-CONTACT-SCOPE-1: an optional `applies_to` scope
 * narrows the GET to that entity's rows; no scope keeps the unfiltered Settings
 * "Algemeen" request. Asserting the exact request (§13), not just that data loaded.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useLastContactTypes } from './useLastContactTypes'

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('useLastContactTypes — applies_to scope', () => {
  it('GETs the unscoped list when no scope is passed', async () => {
    mockedGet.mockResolvedValue({ data: [] })
    renderHook(() => useLastContactTypes())
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/last-contact-types?active=1', undefined))
  })

  it.each(['candidate', 'contact'] as const)(
    'GETs applies_to=%s when scoped to that entity',
    async (scope) => {
      mockedGet.mockResolvedValue({ data: [] })
      renderHook(() => useLastContactTypes(scope))
      await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(`/last-contact-types?active=1&applies_to=${scope}`, undefined))
    },
  )
})
