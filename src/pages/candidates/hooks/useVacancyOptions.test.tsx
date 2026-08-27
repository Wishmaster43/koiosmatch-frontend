/**
 * useVacancyOptions — W30 regression: an optional `search` string forwards a
 * `?search=` param on GET /vacancies (server-side search for >100-vacancy
 * tenants), while the per_page:100 cap and the no-search default stay intact.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useVacancyOptions } from './useVacancyOptions'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrapList: () => ({ rows: [] }),
}))

// Fresh QueryClient per render so no cache leaks between assertions.
function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useVacancyOptions · W30 server search', () => {
  it('omits `search` from the request when none is given', async () => {
    renderHook(() => useVacancyOptions(true), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      params: { per_page: 100 },
    }))
  })

  it('forwards a non-empty search string as `?search=`', async () => {
    renderHook(() => useVacancyOptions(true, 'verzorgende'), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      params: { per_page: 100, search: 'verzorgende' },
    }))
  })
})
