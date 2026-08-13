/**
 * CreditsUsageCard (CREDITS-1) — asserts the REAL request (route + params), per
 * §13: proves the seam. GET /billing/usage, period toggle, credit_price UNROUNDED,
 * and the four UI states.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { formatNumber, formatCurrency } from '@/lib/formatters'
import CreditsUsageCard from './CreditsUsageCard'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// GET /billing/usage — sale-price only. credit_price is deliberately sub-cent
// (0.0125) so tests can assert it renders UNROUNDED (never clipped to two decimals).
const billingUsage = (over = {}) => ({
  workflow: { total_credits: 8000, credit_price: 0.0125, amount: 100, per_day: [], per_workflow: [] },
  ai: { input_tokens: 500, output_tokens: 300, amount: 12.5, per_day: [], per_user: [] },
  ...over,
})

const eur = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v).replace(/\u00a0/g, ' ')

function mockApi(credits = billingUsage()) {
  // Real API wraps in { data: { workflow, ai } } (Laravel-style envelope) — unwrap() strips it.
  api.get.mockImplementation((url) => url === '/billing/usage'
    ? Promise.resolve({ data: { data: credits } })
    : Promise.resolve({ data: {} }))
}

afterEach(() => vi.clearAllMocks())

describe('CreditsUsageCard', () => {
  it('GETs /billing/usage with period=month by default and renders the sale-price totals, credit_price UNROUNDED', async () => {
    mockApi()
    render(<CreditsUsageCard />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/billing/usage', { params: { period: 'month' } }))
    expect(await screen.findByText(formatNumber(8000))).toBeInTheDocument() // workflow.total_credits
    // credit_price 0.0125 must render with its real precision — never rounded
    // down to two decimals ("€ 0,01"); formatCurrency(…, 4, 2) is the component's
    // own call, reused here so the test can't silently drift from it.
    expect(screen.getByText(formatCurrency(0.0125, 'EUR', 'nl-NL', 4, 2).replace(/\u00a0/g, ' '))).toBeInTheDocument()
    expect(screen.getByText(eur(100))).toBeInTheDocument()   // workflow.amount
    expect(screen.getByText(eur(12.5))).toBeInTheDocument()  // ai.amount
  })

  it('refetches with period=prev_month when the previous-month toggle is clicked', async () => {
    mockApi()
    render(<CreditsUsageCard />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/billing/usage', { params: { period: 'month' } }))

    await userEvent.click(screen.getByRole('button', { name: t('billing.usage.credits.periodPrevMonth') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/billing/usage', { params: { period: 'prev_month' } }))
  })

  it('shows the empty state when there is no credits usage yet in the period', async () => {
    mockApi(billingUsage({ workflow: { total_credits: 0, credit_price: 0, amount: 0 }, ai: { input_tokens: 0, output_tokens: 0, amount: 0 } }))
    render(<CreditsUsageCard />)

    expect(await screen.findByText(t('billing.usage.credits.empty'))).toBeInTheDocument()
  })

  it('shows the unavailable notice on a 403 (no billing.view — should be unreachable via the registry gate, but fails safe)', async () => {
    api.get.mockRejectedValue({ response: { status: 403 } })
    render(<CreditsUsageCard />)

    expect(await screen.findByText(t('billing.usage.credits.unavailable'))).toBeInTheDocument()
  })

  it('shows the load-error notice on a non-403 failure', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    render(<CreditsUsageCard />)

    expect(await screen.findByText(t('billing.usage.credits.loadError'))).toBeInTheDocument()
  })
})
