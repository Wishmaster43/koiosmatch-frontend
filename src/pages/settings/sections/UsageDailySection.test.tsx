/**
 * UsageDailySection (USAGE-DAILY-1) — asserts the REAL request (route + params,
 * §13), the four UI states, that the chart+table render the real per-day figures,
 * and — the hard constraint (Danny 13-08) — that no purchase/margin field ever
 * renders even when the (mocked) payload carries one.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import { formatNumber, formatCurrency } from '@/lib/formatters'
import UsageDailySection from './UsageDailySection'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

// RTL's default normalizer collapses whitespace but not the non-breaking space
// Intl inserts after "€" — strip it so text matchers can compare plain strings.
const eur = (v: number) => formatCurrency(v).replace(/\u00a0/g, ' ')

// Real /billing/usage per-day shape (BillingUsageController::workflowUsage/aiUsage).
const billingUsage = (over: Record<string, unknown> = {}) => ({
  workflow: {
    total_credits: 120, credit_price: 0.5, amount: 60,
    per_day: [{ date: '2026-08-01', credits: 100 }, { date: '2026-08-02', credits: 20 }],
    per_workflow: [],
  },
  ai: {
    input_tokens: 900, output_tokens: 300, amount: 3.5,
    per_day: [{ date: '2026-08-01', input_tokens: 900, output_tokens: 300, amount: 3.5 }],
    per_user: [],
  },
  ...over,
})

function mockApi(data: Record<string, unknown> = billingUsage()) {
  // Real envelope: { data: { data: { workflow, ai } } } (api.ts unwrap strips one layer).
  vi.mocked(api.get).mockImplementation((url: string) => url === '/billing/usage'
    ? Promise.resolve({ data: { data } })
    : Promise.resolve({ data: {} }))
}

afterEach(() => vi.clearAllMocks())

describe('UsageDailySection — request seam', () => {
  it('GETs /billing/usage with period=month by default', async () => {
    mockApi()
    render(<UsageDailySection />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/billing/usage', expect.objectContaining({ params: { period: 'month' } }),
    ))
  })
})

describe('UsageDailySection — four UI states', () => {
  it('shows loading, then the merged daily rows in the table', async () => {
    mockApi()
    render(<UsageDailySection />)

    // Day 1: workflow amount = 100 credits * 0.5 = 50, ai amount = 3.5, total = 53.5.
    expect(await screen.findByText(eur(53.5))).toBeInTheDocument()
    // Day 2: workflow amount = 20 * 0.5 = 10, no AI activity that day, total = 10.
    expect(screen.getAllByText(eur(10)).length).toBeGreaterThan(0)
    expect(screen.getByText(formatNumber(1200))).toBeInTheDocument() // day-1 AI tokens (900+300)
  })

  it('renders the empty state when the period has no activity at all', async () => {
    mockApi({
      workflow: { total_credits: 0, credit_price: 0.5, amount: 0, per_day: [], per_workflow: [] },
      ai: { input_tokens: 0, output_tokens: 0, amount: 0, per_day: [], per_user: [] },
    })
    render(<UsageDailySection />)
    expect(await screen.findByText(t('billing.usage.daily.empty'))).toBeInTheDocument()
  })

  it('renders the error notice when the request fails', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => url === '/billing/usage'
      ? Promise.reject(new Error('network'))
      : Promise.resolve({ data: {} }))
    render(<UsageDailySection />)
    expect(await screen.findByText(t('billing.usage.daily.loadError'))).toBeInTheDocument()
  })
})

describe('UsageDailySection — margin secrecy (Danny 13-08: never for the tenant)', () => {
  it('never renders a purchase/margin figure even if the mocked payload were to carry one', async () => {
    mockApi(billingUsage({
      // Simulated leak — the real backend never sends these keys (§9), but this
      // proves the component itself can't be the leak if it ever did.
      workflow: {
        total_credits: 120, credit_price: 0.5, amount: 60, cost: 12, margin_pct: 400,
        per_day: [{ date: '2026-08-01', credits: 100, cost: 10, margin_pct: 400 }],
        per_workflow: [],
      },
    }))
    render(<UsageDailySection />)
    await screen.findByText(eur(53.5))

    expect(screen.queryByText(eur(12))).not.toBeInTheDocument()
    expect(screen.queryByText(/400\s*%/)).not.toBeInTheDocument()
    expect(screen.queryByText(/cost|margin/i)).not.toBeInTheDocument()
  })
})
