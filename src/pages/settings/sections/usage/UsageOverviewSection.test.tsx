/**
 * UsageOverviewSection (BILLING-USAGE-REDESIGN-1) — asserts the real request seam
 * (GET /billing/usage, period param, §13), the KPI row's real figures, and the
 * day-bar/table-row → drill-down open/close flow. The chart itself is mocked at
 * its shallow module boundary — WeeklyBarChartCard renders real DOM elements from
 * `recharts`, unreliable to click in jsdom — so this test drives the drill-down
 * via a table row click instead (UsageDailyTable's own onRowClick), the same code
 * path UsageDayChart's onBarClick calls into (`onSelectDate`).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { formatNumber, formatCurrency } from '@/lib/formatters'
import UsageOverviewSection from './UsageOverviewSection'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }
})

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const eur = (v: number) => formatCurrency(v).replace(/\u00a0/g, ' ')

const billingUsage = (over: Record<string, unknown> = {}) => ({
  workflow: {
    total_credits: 120, credit_price: 0.5, amount: 60,
    per_day: [{ date: '2026-08-17', credits: 100 }, { date: '2026-08-18', credits: 20 }],
    per_workflow: [],
  },
  ai: {
    input_tokens: 900, output_tokens: 300, amount: 3.5,
    per_day: [{ date: '2026-08-17', input_tokens: 900, output_tokens: 300, amount: 3.5 }],
    per_user: [],
  },
  ...over,
})

function mockApi(data: Record<string, unknown> = billingUsage()) {
  vi.mocked(api.get).mockImplementation((url: string) => url === '/billing/usage'
    ? Promise.resolve({ data: { data } })
    : Promise.resolve({ data: {} }))
}

afterEach(() => vi.clearAllMocks())

describe('UsageOverviewSection — request seam', () => {
  it('GETs /billing/usage with period=month by default', async () => {
    mockApi()
    render(<UsageOverviewSection period="month" onPeriodChange={() => {}} wa={null} waLoading={false} />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(
      '/billing/usage', expect.objectContaining({ params: { period: 'month' } }),
    ))
  })
})

describe('UsageOverviewSection — KPI row', () => {
  it('renders the total, workflow, Koios AI and WhatsApp KPI figures from the real payload', async () => {
    mockApi()
    render(<UsageOverviewSection period="month" onPeriodChange={() => {}} wa={{ cost: { total: 18.4 }, usage: { waba_messages: 340 }, currency: 'EUR' }} waLoading={false} />)

    // Total = workflow.amount (60) + ai.amount (3.5) = 63.5.
    expect(await screen.findByText(eur(63.5))).toBeInTheDocument()
    expect(screen.getAllByText(eur(60)).length).toBeGreaterThan(0)   // workflow.amount (KPI card)
    expect(screen.getAllByText(eur(3.5)).length).toBeGreaterThan(0)  // ai.amount (KPI card + table)
    expect(screen.getByText(eur(18.4))).toBeInTheDocument()          // WhatsApp cost.total (prop, own fetch elsewhere)
    // Workflow note carries the credits count AND the unrounded credit price
    // (restored from the old Credits card — Opus round; fixture credit_price 0.5).
    expect(screen.getByText((txt) => txt.includes('120') && txt.includes('credit'))).toBeInTheDocument()
    expect(screen.getByText(t('billing.usage.kpi.whatsappNote', { n: formatNumber(340) }))).toBeInTheDocument() // WhatsApp message count (KPI note)
  })
})

describe('UsageOverviewSection — drill-down open/close', () => {
  it('opens the day detail card on a table row click, and closes it on the close button', async () => {
    mockApi()
    render(<UsageOverviewSection period="month" onPeriodChange={() => {}} wa={null} waLoading={false} />)
    await screen.findByText(eur(63.5))

    // Day 1 (17-08) total = 50 (workflow) + 3.5 (ai) = 53.5 — click that row.
    const row = await screen.findByText(eur(53.5))
    await userEvent.click(row)

    expect(await screen.findByText(t('billing.usage.daily.drilldownTitle', { date: '17-08-2026' }))).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: t('billing.usage.daily.drilldownClose') }))
    expect(screen.queryByText(t('billing.usage.daily.drilldownTitle', { date: '17-08-2026' }))).not.toBeInTheDocument()
  })
})
