/**
 * SubscriptionCard (CREDITS-2-FE deel 1) — asserts the two meter values, the
 * DD-MM reset date and the honest over-budget line render from real prop data.
 */
import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { formatCurrency } from '@/lib/formatters'
import SubscriptionCard from './SubscriptionCard'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const subscription = {
  package_key: 'pro',
  package_label: 'Koios Pro',
  resets_at: '2026-09-01T00:00:00Z',
  ai: { budget: 1000, used: 400, over: 0, over_amount: 0 },
  workflow: { budget: 500, used: 620, over: 120, over_amount: 12.5 },
}

describe('SubscriptionCard', () => {
  it('renders the package label, both meter values and the DD-MM reset date', () => {
    render(<SubscriptionCard subscription={subscription} phase="ready" />)
    expect(screen.getByText('Koios Pro')).toBeInTheDocument()
    expect(screen.getByText(t('billing.usage.plan.meterUsage', { used: '400', remaining: '600' }))).toBeInTheDocument()
    expect(screen.getByText(t('billing.usage.plan.meterUsage', { used: '620', remaining: '0' }))).toBeInTheDocument()
    expect(screen.getByText(/01-09-2026/)).toBeInTheDocument()
  })

  it('shows the honest over-budget line with the EUR amount when over>0', () => {
    render(<SubscriptionCard subscription={subscription} phase="ready" />)
    const eur = formatCurrency(12.5).replace(/\u00A0/g, ' ')
    const match = screen.getAllByText((_, el) => el?.textContent?.replace(/\u00A0/g, ' ').includes(eur) ?? false)
    expect(match.length).toBeGreaterThan(0)
  })

  // Opus round (golf 4): `over` is a count — within budget it is 0 and NOTHING
  // may leak ('{0 && …}' printed a bare 0 on the billing screen), and a
  // zero-usage month still shows the meters (empty phase + subscription).
  it('renders no over-line and no stray zero when within budget, and keeps meters on an empty month', () => {
    const within = { ...subscription, workflow: { budget: 500, used: 120, over: 0, over_amount: 0 } }
    const { container, rerender } = render(<SubscriptionCard subscription={within} phase="ready" />)
    expect(screen.queryByText(/boven budget|over budget/i)).toBeNull()
    expect(container.textContent).not.toMatch(/1\.0000|5000\b/)

    rerender(<SubscriptionCard subscription={within} phase="empty" />)
    expect(screen.getByText(t('billing.usage.plan.meterUsage', { used: '400', remaining: '600' }))).toBeInTheDocument()
    expect(screen.queryByText(t('billing.usage.plan.notice'))).toBeNull()
  })

  // Danny 24-08: the meter is a gateway — clicking it drills into the daily
  // chart filtered on that meter's own series.
  it('fires the per-meter drill on click', async () => {
    const user = userEvent.setup()
    const onDrillAi = vi.fn(); const onDrillWorkflow = vi.fn()
    render(<SubscriptionCard subscription={subscription} phase="ready" onDrillAi={onDrillAi} onDrillWorkflow={onDrillWorkflow} />)
    await user.click(screen.getByRole('button', { name: new RegExp(t('billing.usage.plan.aiMeter')) }))
    expect(onDrillAi).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: new RegExp(t('billing.usage.plan.workflowMeter')) }))
    expect(onDrillWorkflow).toHaveBeenCalledTimes(1)
  })

  it('renders loading/empty/error/unavailable states honestly', () => {
    const { rerender } = render(<SubscriptionCard subscription={null} phase="loading" />)
    expect(screen.getByText(t('common.loadingShort'))).toBeInTheDocument()

    rerender(<SubscriptionCard subscription={null} phase="empty" />)
    expect(screen.getByText(t('billing.usage.plan.notice'))).toBeInTheDocument()

    rerender(<SubscriptionCard subscription={null} phase="error" />)
    expect(screen.getByText(t('billing.usage.plan.loadError'))).toBeInTheDocument()

    rerender(<SubscriptionCard subscription={null} phase="unavailable" />)
    expect(screen.getByText(t('billing.usage.plan.unavailable'))).toBeInTheDocument()
  })
})
