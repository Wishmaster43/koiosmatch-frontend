/**
 * UsageOverviewSection (F5 25-08 refactor) — now a pure presenter (data/phase
 * arrive as props, the fetch and the period filter moved to BillingUsageSettings).
 * Asserts the KPI row's real figures and the day-bar/table-row → drill-down
 * open/close flow. The chart itself is exercised via UsageDailyTable's own
 * onRowClick (the same code path UsageDayChart's onBarClick calls into).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { formatNumber, formatCurrency } from '@/lib/formatters'
import UsageOverviewSection from './UsageOverviewSection'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })
const eur = (v: number) => formatCurrency(v).replace(new RegExp(String.fromCharCode(160), 'g'), ' ')

const billingUsage = {
  workflow: {
    total_credits: 120, overage_price: 0.5, amount: 60,
    per_day: [{ date: '2026-08-17', credits: 100 }, { date: '2026-08-18', credits: 20 }],
    per_workflow: [],
  },
  ai: {
    input_tokens: 900, output_tokens: 300, amount: 3.5,
    per_day: [{ date: '2026-08-17', input_tokens: 900, output_tokens: 300, amount: 3.5 }],
    per_user: [],
  },
  whatsapp: {
    by_channel: [{ channel: 'wa_web', label: 'WA Web', messages: 340 }, { channel: 'waba', label: 'WABA', messages: 0 }],
  },
}

describe('UsageOverviewSection — KPI row', () => {
  it('renders the total, workflow, AI and WhatsApp KPI figures from the real payload', () => {
    render(<UsageOverviewSection data={billingUsage} phase="ready" />)

    // Total = workflow.amount (60) + ai.amount (3.5) = 63.5.
    expect(screen.getByText(eur(63.5))).toBeInTheDocument()
    expect(screen.getAllByText(eur(60)).length).toBeGreaterThan(0)   // workflow.amount (KPI card)
    expect(screen.getAllByText(eur(3.5)).length).toBeGreaterThan(0)  // ai.amount (KPI card + table)
    // K-242 (02-09): WhatsApp tile shows the sum of by_channel[].messages (340)
    // with per-channel note "WA Web (340) · WABA (0)" for channels with messages > 0.
    expect(screen.getByText(formatNumber(340))).toBeInTheDocument()          // WhatsApp total messages
    expect(screen.getByText(/WA Web.*340/)).toBeInTheDocument()              // Per-channel note includes label + count
    // K-242 (02-09) rename: the workflow meter is "workflow-tokens" now (was
    // "workflow-runs"), never "Koios Tokens".
    expect(screen.getByText((txt) => txt.includes('120') && txt.includes('workflow-tokens'))).toBeInTheDocument()
  })
})

describe('UsageOverviewSection — drill-down open/close', () => {
  it('opens the day detail card on a table row click, and closes it on the close button', async () => {
    render(<UsageOverviewSection data={billingUsage} phase="ready" />)
    await screen.findByText(eur(63.5))

    // Day 1 (17-08) total = 50 (workflow) + 3.5 (ai) = 53.5 — click that row.
    const row = await screen.findByText(eur(53.5))
    await userEvent.click(row)

    expect(await screen.findByText(t('billing.usage.daily.drilldownTitle', { date: '17-08-2026' }))).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: t('billing.usage.daily.drilldownClose') }))
    expect(screen.queryByText(t('billing.usage.daily.drilldownTitle', { date: '17-08-2026' }))).not.toBeInTheDocument()
  })
})

describe('UsageOverviewSection — non-ready phases', () => {
  it('renders the loading/error/empty/unavailable states honestly', () => {
    const { rerender } = render(<UsageOverviewSection data={undefined} phase="loading" />)
    expect(screen.getByText(t('common.loadingShort'))).toBeInTheDocument()
    rerender(<UsageOverviewSection data={undefined} phase="error" />)
    expect(screen.getByText(t('billing.usage.daily.loadError'))).toBeInTheDocument()
    rerender(<UsageOverviewSection data={undefined} phase="empty" />)
    expect(screen.getByText(t('billing.usage.daily.empty'))).toBeInTheDocument()
    rerender(<UsageOverviewSection data={undefined} phase="unavailable" />)
    expect(screen.getByText(t('billing.usage.credits.unavailable'))).toBeInTheDocument()
  })
})
