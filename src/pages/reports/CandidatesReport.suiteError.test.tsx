/** CandidatesReport · a failed KPI suite shows the error banner and retry refetches GET /reports/candidates/kpis. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import CandidatesReport from './CandidatesReport'
import { data } from './CandidatesReport.testKit'

const mockUseCandidatesReport = vi.fn()
vi.mock('./useCandidatesReport', () => ({ useCandidatesReport: (...args: unknown[]) => mockUseCandidatesReport(...args) }))
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ phases: [] }) }))

const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => getSpy(...args) },
  unwrapList: (r: { data: { data?: unknown[]; meta?: { total?: number } } }) => ({ rows: r.data?.data ?? [], total: r.data?.meta?.total ?? 0 }),
  getActiveTenantId: () => 'test-tenant',
}))
vi.mock('./hooks/useReportKpiSelection', () => ({ useReportKpiSelection: () => ({ data: [] as string[], isLoading: false }) }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => ({}) }
})

describe('CandidatesReport KPI suite error', () => {
  afterEach(() => getSpy.mockReset())

  it('renders the suite error key and retry fires a second suite GET', async () => {
    mockUseCandidatesReport.mockReturnValue({ data, loading: false, error: null, refetch: vi.fn() })
    getSpy.mockRejectedValue(new Error('boom'))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><CandidatesReport period="month" /></QueryClientProvider>)
    expect(await screen.findByText(i18n.t('analytics:candidates.kpiSuiteError'))).toBeInTheDocument()
    const suiteCalls = () => getSpy.mock.calls.filter(c => c[0] === '/reports/candidates/kpis').length
    const before = suiteCalls()
    expect(before).toBeGreaterThan(0)
    const banner = screen.getByText(i18n.t('analytics:candidates.kpiSuiteError')).closest('[role="alert"]') ?? document.body
    await userEvent.click(banner.querySelector('button') as HTMLElement)
    await waitFor(() => expect(suiteCalls()).toBeGreaterThan(before))
  })
})
