/**
 * TenantLimitsSettings — asserts the real GET, one meter per row, the billing tier
 * line only when `prices` is present, and the honest empty/error states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import i18n from '@/i18n'
import TenantLimitsSettings from './TenantLimitsSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})

const t = (k: string, o?: Record<string, unknown>) => i18n.t(k, { ns: 'settings', ...o })

const rows = [
  { key: 'ai', label: 'Koios AI-tokens', scope: 'tenant', window: 'month', used: 12000, cap: 50000, percent: 24, cap_reached: false,
    // The real shape (measured on demo): the whole tier meter, chosen tier nested under `tier`.
    prices: { tier: { unit: 'koios_ai_token', tier: { key: 'smart', label: 'Slim', monthly_tokens: 50000, price_cents: 4900, source: 'chosen' }, allowance: 50000, baseline_tier: { key: 'assist', label: 'Koios Assist', monthly_tokens: 500, price_cents: 0 } } } },
  { key: 'geocode_search', label: 'Adres zoeken (geocoding)', scope: 'tenant', window: 'day', used: 3, cap: 500, percent: 0, cap_reached: false },
  { key: 'sm', label: 'Shiftmanager', scope: 'tenant', window: 'month', used: 60, cap: null, percent: null, cap_reached: false },
]

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TenantLimitsSettings /></QueryClientProvider>,
)

beforeEach(() => vi.clearAllMocks())

describe('TenantLimitsSettings', () => {
  it('GETs the tenant limits and renders one meter per row', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: rows } })
    renderPage()
    expect(await screen.findByText('Koios AI-tokens')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/settings/integrations/limits')
    expect(screen.getAllByRole('progressbar')).toHaveLength(2)
    expect(screen.getByText(t('limits.no_limit'))).toBeInTheDocument()
  })

  it('shows the billing tier line only for a row that carries prices (chosen tier wins over the baseline)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: rows } })
    renderPage()
    await screen.findByText('Koios AI-tokens')
    const tier = t('limits.tier.included', { tier: 'Slim', n: '50.000' })
    expect(screen.getAllByText(new RegExp(tier))).toHaveLength(1)
    expect(screen.queryByText(/Koios Assist/)).not.toBeInTheDocument()
  })

  it('falls back to the package baseline tier when no tier was chosen', async () => {
    const baselineOnly = [{ ...rows[0], prices: { tier: { unit: 'koios_ai_token', tier: null, allowance: 500, baseline_tier: { key: 'assist', label: 'Koios Assist', monthly_tokens: 500, price_cents: 0 } } } }]
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: baselineOnly } })
    renderPage()
    await screen.findByText('Koios AI-tokens')
    expect(screen.getByText(new RegExp(t('limits.tier.included', { tier: 'Koios Assist', n: '500' })))).toBeInTheDocument()
  })

  it('renders the empty state when no meter came back', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    renderPage()
    expect(await screen.findByText(t('limits.empty'))).toBeInTheDocument()
  })

  it('renders the scaffold load error, never a raw server message', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('boom'))
    renderPage()
    expect(await screen.findByText(t('common.loadError'))).toBeInTheDocument()
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })
})
