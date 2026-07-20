/**
 * GebruikSettings (billing_usage, USAGE-LIMITS-1) — asserts the REAL usage
 * requests (route + params), per §13: a mutation/read test must prove the seam,
 * never only that a callback fired. Covers the AI usage period toggle (the one
 * piece of the reference screenshot the backend actually supports today) and the
 * WhatsApp usage fetch, plus the two honest "not built yet" notices for the
 * plan/credits and daily-breakdown pieces that have no backend behind them.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import GebruikSettings from './GebruikSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

const aiUsage = (over = {}) => ({
  period: 'month', tenant_id: 't1',
  totals: { calls: 12, input_tokens: 1000, output_tokens: 500, cost: 0.42, currency: 'EUR' },
  // Deliberately a different cost than totals (0.42) so the tests can assert
  // each rendered value unambiguously.
  per_activity: [{ activity: 'chat', calls: 12, input_tokens: 1000, output_tokens: 500, cost: 0.30 }],
  forecast: { based_on_days: 7, avg_daily_cost: 0.06, projected_month_cost: 1.8, currency: 'EUR' },
  ...over,
})

const messagingCosts = (over = {}) => ({
  period: '2026-07', currency: 'EUR',
  usage: { active_numbers: 2, waba_messages: 340 },
  cost: { numbers: 10, waba_messages: 3.4, base: 5, total: 18.4 },
  // Deliberately a different value than the aggregate total (340) so the tests
  // can assert each rendered number unambiguously.
  by_number: [{ sending_ref: 'abc', label: '+31 6 1234 5678', channel: 'waba', messages: 200, cost: 3.4 }],
  ...over,
})

// Same Intl call the component uses (§5 — never hardcode a locale-formatted string).
// RTL's default normalizer collapses the non-breaking space Intl inserts after "€"
// into a regular space before matching, so do the same here.
const eur = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v).replace(/\u00A0/g, ' ')

function mockApi({ ai = aiUsage(), wa = messagingCosts() } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/ai/koios/usage') return Promise.resolve({ data: ai })
    if (url === '/settings/messaging-costs') return Promise.resolve({ data: { data: wa } })
    return Promise.resolve({ data: {} })
  })
}

afterEach(() => vi.clearAllMocks())

describe('GebruikSettings — AI usage', () => {
  it('GETs /ai/koios/usage with period=month by default and renders the real totals', async () => {
    mockApi()
    render(<GebruikSettings />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/koios/usage', { params: { period: 'month' } }))
    expect(await screen.findByText(eur(0.42))).toBeInTheDocument() // totals.cost, nl-NL EUR
  })

  it('refetches with period=today when the period toggle is clicked', async () => {
    mockApi()
    render(<GebruikSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/koios/usage', { params: { period: 'month' } }))

    await userEvent.click(screen.getByRole('button', { name: t('billing.usage.periodToday') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/koios/usage', { params: { period: 'today' } }))
  })

  it('shows the empty state when there is no usage yet in the period (never a fake zero-tile row)', async () => {
    mockApi({ ai: aiUsage({ totals: { calls: 0, input_tokens: 0, output_tokens: 0, cost: 0, currency: 'EUR' }, per_activity: [] }) })
    render(<GebruikSettings />)

    expect(await screen.findByText(t('billing.usage.ai.empty'))).toBeInTheDocument()
  })
})

describe('GebruikSettings — WhatsApp usage', () => {
  it('GETs /settings/messaging-costs and renders the real message count', async () => {
    mockApi()
    render(<GebruikSettings />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings/messaging-costs'))
    expect(await screen.findByText('340')).toBeInTheDocument()
  })
})

describe('GebruikSettings — blocked pieces render an honest notice, never fake numbers', () => {
  it('shows the plan/credits and daily-breakdown notices instead of fabricated data', async () => {
    mockApi()
    render(<GebruikSettings />)

    expect(await screen.findByText(t('billing.usage.plan.notice'))).toBeInTheDocument()
    expect(screen.getByText(t('billing.usage.daily.notice'))).toBeInTheDocument()
  })
})
