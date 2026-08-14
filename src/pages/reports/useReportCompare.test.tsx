/**
 * useReportCompare — request-shape test (§13: assert the REQUEST). Proves both
 * window forms reach GET /reports/{slug}/compare correctly, that a null slug or
 * an 'off'/incomplete-custom mode fires NO request at all, and that a custom
 * range never travels alongside a `compare` preset key (the exact ambiguity the
 * backend 422s on — this hook must not be able to produce it).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useReportCompare } from './useReportCompare'

const getSpy = vi.fn().mockResolvedValue({ data: { report: 'candidates', total: { current: 10, previous: 8, delta: 2, delta_pct: 25 } } })
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => getSpy(...args) } }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useReportCompare — request shape', () => {
  afterEach(() => getSpy.mockClear())

  it('sends `compare` for a preset window, layered on the report\'s own from/to + filters', async () => {
    const { result } = renderHook(
      () => useReportCompare('candidates', '2026-01-01', '2026-01-31', { kind: 'previous_year' }, { status: ['available'] }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports/candidates/compare', expect.objectContaining({
      params: { status: ['available'], from: '2026-01-01', to: '2026-01-31', compare: 'previous_year' },
    }))
  })

  it('sends compare_from/compare_to for a custom window — never a `compare` key alongside it', async () => {
    const { result } = renderHook(
      () => useReportCompare('candidates', '2026-01-01', '2026-01-31', { kind: 'custom', from: '2025-01-01', to: '2025-01-31' }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    const call = getSpy.mock.calls[0][1] as { params: Record<string, unknown> }
    expect(call.params).toEqual({ from: '2026-01-01', to: '2026-01-31', compare_from: '2025-01-01', compare_to: '2025-01-31' })
    expect(call.params).not.toHaveProperty('compare')
  })

  it('fires no request when the mode is off', async () => {
    renderHook(() => useReportCompare('candidates', '2026-01-01', '2026-01-31', { kind: 'off' }), { wrapper })
    await new Promise(r => setTimeout(r, 0))
    expect(getSpy).not.toHaveBeenCalled()
  })

  it('fires no request when the report has no compare slug', async () => {
    renderHook(() => useReportCompare(null, '2026-01-01', '2026-01-31', { kind: 'previous_period' }), { wrapper })
    await new Promise(r => setTimeout(r, 0))
    expect(getSpy).not.toHaveBeenCalled()
  })

  it('fires no request for an incomplete custom range', async () => {
    renderHook(() => useReportCompare('candidates', '2026-01-01', '2026-01-31', { kind: 'custom', from: '2025-01-01', to: '' }), { wrapper })
    await new Promise(r => setTimeout(r, 0))
    expect(getSpy).not.toHaveBeenCalled()
  })

  it('routes ai/workflows through their own slug the same way as every other report', async () => {
    const { result } = renderHook(
      () => useReportCompare('ai', '2026-01-01', '2026-01-31', { kind: 'previous_period' }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports/ai/compare', expect.anything())
  })
})
