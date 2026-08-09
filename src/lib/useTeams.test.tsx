/**
 * useTeams — the internal-department lookup behind the task "Interne afdeling"
 * pickers (TEAM-1, backend e0e2277f).
 *
 * Two things are pinned here, both measured live on 09-08 against
 * `GET /teams` (yesway): the endpoint answers with a BARE array (no `data`
 * envelope), and it can legitimately be EMPTY — the tenant had no departments at
 * all. So the hook must map a bare array correctly and must distinguish "empty"
 * from "failed": a load error that silently reads as "no departments" is the §3
 * dishonest-empty-state bug, and here it would quietly hide the whole feature.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Real unwrapList (the hook relies on its bare-array branch); only the network
// call and the active-tenant getter are stubbed — mirrors lib/queries.test.tsx.
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return { ...actual, default: { get: vi.fn() }, getActiveTenantId: vi.fn(() => null) }
})

import api, { getActiveTenantId } from './api'
import { useTeams } from './useTeams'

const mockedGet = vi.mocked(api.get)
const mockedTenantId = vi.mocked(getActiveTenantId)

afterEach(() => {
  vi.clearAllMocks()
  mockedTenantId.mockReturnValue(null)
})

// One fresh QueryClient per render (no cross-test cache leakage); retry:false so a
// rejected fetch settles immediately instead of running React Query's backoff.
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('useTeams', () => {
  it('maps the measured bare-array response to picker options, colour included', async () => {
    mockedGet.mockResolvedValue({
      data: [
        // eslint-disable-next-line no-restricted-syntax -- API fixture colour (DATA, mirrors the live row)
        { id: 'team-1', name: 'Backoffice', color: '#2563EB', in_use: false },
        { id: 'team-2', name: 'Planning', color: null, in_use: true },
      ],
    })

    const { result } = renderHook(() => useTeams(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.teams).toHaveLength(2))
    expect(mockedGet).toHaveBeenCalledWith('/teams', expect.anything())
    expect(result.current.teams).toEqual([
      // eslint-disable-next-line no-restricted-syntax -- API fixture colour (DATA, mirrors the live row)
      { value: 'team-1', label: 'Backoffice', color: '#2563EB' },
      { value: 'team-2', label: 'Planning', color: null },
    ])
    expect(result.current.error).toBe(false)
  })

  it('reports a failed load as an ERROR, not as an empty department list', async () => {
    mockedGet.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useTeams(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.error).toBe(true))
    // The list is empty either way — which is exactly why the flag has to exist.
    expect(result.current.teams).toEqual([])
  })

  it('keys the cache per tenant — another bureau never sees these departments', async () => {
    mockedTenantId.mockReturnValue('tenant-a')
    mockedGet.mockResolvedValue({ data: [{ id: 'a-1', name: 'Backoffice A', color: null }] })

    const wrapper = makeWrapper()
    const first = renderHook(() => useTeams(), { wrapper })
    await waitFor(() => expect(first.result.current.teams).toHaveLength(1))

    mockedTenantId.mockReturnValue('tenant-b')
    mockedGet.mockResolvedValue({ data: [{ id: 'b-1', name: 'Backoffice B', color: null }] })
    const second = renderHook(() => useTeams(), { wrapper })

    await waitFor(() => expect(second.result.current.teams[0]?.label).toBe('Backoffice B'))
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })
})
