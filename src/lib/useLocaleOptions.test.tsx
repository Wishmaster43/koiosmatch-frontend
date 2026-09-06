/**
 * useLocaleOptions — asserts the REAL request (§13) and the pass-through of the
 * three code/label lists; a failure keeps the empty lists (never a crash).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import api from '@/lib/api'
import { useLocaleOptions } from './useLocaleOptions'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useLocaleOptions', () => {
  it('GETs /settings/locale-options and exposes the three code/label lists', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: {
      currencies: [{ code: 'EUR', label: 'Euro (€)' }, { code: 'GBP', label: 'Pond sterling (£)' }],
      timezones: [{ code: 'Europe/Amsterdam', label: 'Amsterdam (CET)' }],
      languages: [{ code: 'nl', label: 'Nederlands' }],
    } } })
    const { result } = renderHook(() => useLocaleOptions(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/settings/locale-options', expect.objectContaining({ signal: expect.anything() }))
    expect(result.current.options.currencies.map(c => c.code)).toEqual(['EUR', 'GBP'])
    expect(result.current.options.timezones[0].code).toBe('Europe/Amsterdam')
    expect(result.current.options.languages[0].label).toBe('Nederlands')
  })

  it('keeps the empty lists on a failed request', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useLocaleOptions(), { wrapper })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.options).toEqual({ currencies: [], timezones: [], languages: [] })
  })
})
