/**
 * GebruikSettings (billing_usage, USAGE-LIMITS-1 + CREDITS-1) — asserts the REAL
 * usage requests (route + params), per §13: a mutation/read test must prove the
 * seam, never only that a callback fired. Covers the AI usage period toggle
 * (post-CREDITS-1 amount keys), the WhatsApp usage fetch, the K0 Koios AI billing
 * block (month param + clickable per_module breakdown, claude.cost/margin gone),
 * and the two honest "not built yet" notices for the plan/credits and daily-
 * breakdown pieces that have no backend behind them. The new Credits headline
 * block is its own component/test file (CreditsUsageCard.test.jsx, §3 size split).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { formatNumber } from '@/lib/formatters'
import GebruikSettings from './GebruikSettings'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// CREDITS-1 §9-reparatie: sale-price `amount` keys, never the old `cost` keys.
const aiUsage = (over = {}) => ({
  period: 'month', tenant_id: 't1',
  totals: { calls: 12, input_tokens: 1000, output_tokens: 500, amount: 0.42, currency: 'EUR' },
  // Deliberately a different amount than totals (0.42) so the tests can assert
  // each rendered value unambiguously.
  per_activity: [{ activity: 'chat', calls: 12, input_tokens: 1000, output_tokens: 500, amount: 0.30 }],
  forecast: { based_on_days: 7, avg_daily_amount: 0.06, projected_month_amount: 1.8, currency: 'EUR' },
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

// K0 billing contract: GET /ai/koios/usage/billing?month=YYYY-MM -- invoice-ready
// Claude + workflow-token totals. CREDITS-1 §9-reparatie: claude.cost and
// claude.margin_pct are REMOVED from this response — never send/assert them.
const koiosBilling = (over = {}) => ({
  month: '2026-08',
  claude: { tokens_in: 12000, tokens_out: 4000, free_allowance: 10000, billable_cost: 5.12 },
  workflow: { total_module_runs: 6000, per_module: { whatsapp_send: 2100, pdok_geocode: 1800 }, price_cents_per_run: 1, amount: 60 },
  total_amount: 65.12,
  currency: 'EUR',
  ...over,
})

// Same Intl call the component uses (§5 -- never hardcode a locale-formatted string).
// RTL's default normalizer collapses the non-breaking space Intl inserts after "€"
// into a regular space before matching, so do the same here.
const eur = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v).replace(/\u00a0/g, ' ')

function mockApi({ ai = aiUsage(), wa = messagingCosts(), billing = koiosBilling() } = {}) {
  api.get.mockImplementation((url) => {
    if (url === '/ai/koios/usage') return Promise.resolve({ data: ai })
    if (url === '/settings/messaging-costs') return Promise.resolve({ data: { data: wa } })
    if (url === '/ai/koios/usage/billing') return Promise.resolve({ data: billing })
    // GebruikSettings also renders CreditsUsageCard, which fires its own
    // GET /billing/usage — covered by CreditsUsageCard.test.jsx; an empty stub
    // here just keeps that card in its harmless "empty" phase.
    return Promise.resolve({ data: {} })
  })
}

afterEach(() => vi.clearAllMocks())

describe('GebruikSettings — AI usage', () => {
  it('GETs /ai/koios/usage with period=month by default and renders the real totals (amount, post-CREDITS-1)', async () => {
    mockApi()
    render(<GebruikSettings />)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/koios/usage', { params: { period: 'month' } }))
    expect(await screen.findByText(eur(0.42))).toBeInTheDocument() // totals.amount, nl-NL EUR
  })

  it('refetches with period=today when the period toggle is clicked', async () => {
    mockApi()
    render(<GebruikSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/koios/usage', { params: { period: 'month' } }))

    await userEvent.click(screen.getByRole('button', { name: t('billing.usage.periodToday') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/koios/usage', { params: { period: 'today' } }))
  })

  it('shows the empty state when there is no usage yet in the period (never a fake zero-tile row)', async () => {
    mockApi({ ai: aiUsage({ totals: { calls: 0, input_tokens: 0, output_tokens: 0, amount: 0, currency: 'EUR' }, per_activity: [] }) })
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

describe('GebruikSettings — Koios AI billing (K0, post-CREDITS-1)', () => {
  it('GETs /ai/koios/usage/billing with the current month by default and renders billable_cost + total (never claude.cost/margin_pct)', async () => {
    mockApi()
    render(<GebruikSettings />)

    // Default month must be a real 'YYYY-MM' key — never hardcode "now" in the assertion,
    // it would drift the day this test runs in a different month than it was written.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/koios/usage/billing', { params: { month: expect.stringMatching(/^\d{4}-\d{2}$/) } }))
    expect(await screen.findByText(eur(5.12))).toBeInTheDocument()  // claude.billable_cost
    expect(screen.getByText(eur(65.12))).toBeInTheDocument()        // total_amount
    expect(screen.getByText(formatNumber(12000))).toBeInTheDocument() // claude.tokens_in
    // The removed field must never render — its label is gone from the DOM.
    expect(screen.queryByText(t('billing.usage.koios.claude.margin'))).not.toBeInTheDocument()
  })

  it('refetches with the picked month when the month input changes', async () => {
    mockApi()
    render(<GebruikSettings />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/koios/usage/billing', expect.anything()))

    // fireEvent.change (not userEvent.type) — `<input type="month">` is a picker
    // widget userEvent can't type character-by-character; a direct value swap
    // mirrors how a real month-picker commits a selection.
    fireEvent.change(screen.getByLabelText(t('billing.usage.koios.monthLabel')), { target: { value: '2026-05' } })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ai/koios/usage/billing', { params: { month: '2026-05' } }))
  })

  it('reveals the per_module breakdown only after clicking the workflow line (clickable, not always-on)', async () => {
    mockApi()
    render(<GebruikSettings />)
    await screen.findByText(eur(65.12))

    // Collapsed by default — the per-module module keys are not in the document yet.
    expect(screen.queryByText('whatsapp_send')).not.toBeInTheDocument()

    const workflowLineName = t('billing.usage.koios.workflow.line', { n: formatNumber(6000) })
    await userEvent.click(screen.getByRole('button', { name: workflowLineName }))

    expect(await screen.findByText('whatsapp_send')).toBeInTheDocument()
    expect(screen.getByText(formatNumber(2100))).toBeInTheDocument()

    // Clicking again collapses it.
    await userEvent.click(screen.getByRole('button', { name: workflowLineName }))
    expect(screen.queryByText('whatsapp_send')).not.toBeInTheDocument()
  })

  it('shows the empty state when there is no Koios usage yet this month', async () => {
    mockApi({ billing: koiosBilling({ claude: { tokens_in: 0, tokens_out: 0, free_allowance: 10000, billable_cost: 0 }, workflow: { total_module_runs: 0, per_module: {}, price_cents_per_run: 1, amount: 0 }, total_amount: 0 }) })
    render(<GebruikSettings />)

    expect(await screen.findByText(t('billing.usage.koios.empty'))).toBeInTheDocument()
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

describe('GebruikSettings — EXCEL-1 usage export', () => {
  it('GETs /billing/usage/export as a blob with the active period, real request seam', async () => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() })
    mockApi()
    // Override the generic mock so /billing/usage/export resolves a blob while
    // every other route keeps flowing through the shared aiUsage/wa/billing stubs.
    const originalImpl = api.get.getMockImplementation()
    api.get.mockImplementation((url, config) => {
      if (url === '/billing/usage/export') return Promise.resolve({ data: new Blob(['xlsx'], { type: 'application/vnd.openxmlformats' }) })
      return originalImpl(url, config)
    })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<GebruikSettings />)
    const exportBtn = await screen.findByRole('button', { name: t('billing.usage.exportXlsx') })
    await userEvent.click(exportBtn)

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/billing/usage/export', { params: { period: 'month' }, responseType: 'blob' }))
    expect(clickSpy).toHaveBeenCalled()

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})
