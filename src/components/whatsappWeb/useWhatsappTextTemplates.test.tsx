/**
 * useWhatsappTextTemplates: the react-query read, its enabled gate and the meta fallbacks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import api from '@/lib/api'
import { useWhatsappTextTemplates } from './useWhatsappTextTemplates'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() }, getActiveTenantId: () => 'tenant-1' }
})

const mocked = api as unknown as { get: ReturnType<typeof vi.fn> }
const row = { id: 't1', name: 'Intro', body: 'Hoi {{first_name}}', language: 'nl', is_active: true }

// A fresh client per test so no cached list leaks between cases.
const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => { vi.clearAllMocks() })

describe('useWhatsappTextTemplates', () => {
  it('GETs the list once and exposes rows and meta placeholders', async () => {
    mocked.get.mockResolvedValueOnce({ data: { data: [row], meta: { placeholders: ['first_name'] } } })
    const { result } = renderHook(() => useWhatsappTextTemplates(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.templates).toEqual([row]))
    expect(result.current.placeholders).toEqual(['first_name'])
    expect(mocked.get).toHaveBeenCalledTimes(1)
    expect(mocked.get.mock.calls[0][0]).toBe('/whatsapp-text-templates')
  })

  it('fires no request when disabled and exposes stable empty lists', () => {
    const { result, rerender } = renderHook(() => useWhatsappTextTemplates(false), { wrapper: wrap() })
    expect(mocked.get).not.toHaveBeenCalled()
    const first = result.current.templates
    rerender()
    expect(result.current.templates).toBe(first)
    expect(result.current.placeholders).toEqual([])
  })

  it('a missing meta yields an empty placeholder list; a failed GET yields empty rows and isError', async () => {
    mocked.get.mockResolvedValueOnce({ data: { data: [row] } })
    const a = renderHook(() => useWhatsappTextTemplates(), { wrapper: wrap() })
    await waitFor(() => expect(a.result.current.templates).toEqual([row]))
    expect(a.result.current.placeholders).toEqual([])
    mocked.get.mockRejectedValueOnce(Object.assign(new Error('404'), { response: { status: 404 } }))
    const b = renderHook(() => useWhatsappTextTemplates(), { wrapper: wrap() })
    await waitFor(() => expect(b.result.current.isError).toBe(true))
    expect(b.result.current.templates).toEqual([])
  })
})
