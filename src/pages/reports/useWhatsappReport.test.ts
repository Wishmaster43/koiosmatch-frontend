/**
 * useWhatsappReport — pins the REAL data route (GET /reports/whatsapp, CMBE
 * f7a2c6f8). Round 1 shipped against an imagined '/reports/whatsapp/kpis' URL
 * with a green suite; this seam test makes that impossible to repeat (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useWhatsappReport } from './useWhatsappReport'

const getSpy = vi.fn().mockResolvedValue({ data: { meta: { period: 'month', from: '2026-08-01', to: '2026-08-24', total: 3 }, kpis: [] } })
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  getActiveTenantId: () => 'test-tenant',
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children)
}

describe('useWhatsappReport', () => {
  beforeEach(() => getSpy.mockClear())
  it('fetches GET /reports/whatsapp with the period — never a /kpis data route', async () => {
    const { result } = renderHook(() => useWhatsappReport('month'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports/whatsapp', expect.objectContaining({ params: { period: 'month' } }))
    expect(result.current.data?.meta.total).toBe(3)
  })

  it('does not fetch at all when disabled (tenant without the whatsapp module)', async () => {
    renderHook(() => useWhatsappReport('month', false), { wrapper })
    await new Promise(r => setTimeout(r, 10))
    expect(getSpy).not.toHaveBeenCalledWith('/reports/whatsapp', expect.anything())
  })
})
