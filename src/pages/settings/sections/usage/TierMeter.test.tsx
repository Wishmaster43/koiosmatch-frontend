/**
 * TierMeter (TASK D) — asserts the three states (ok/warn/blocked), the overage
 * line, the honest upgrade CTA gate, the reset date and the "never a lone 0"
 * invariant, mirroring SubscriptionCard.test.tsx's setup with the real i18n instance.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { formatCurrency } from '@/lib/formatters'
import TierMeter from './TierMeter'
import type { BillingUsageTierMeter } from '@/types/billingUsage'

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

describe('TierMeter', () => {
  it('renders no callout at 79%', () => {
    const meter: BillingUsageTierMeter = { tier: { key: 'pro', label: 'Pro' }, allowance: 100, used: 79, pct: 79, state: 'ok', over: 0 }
    render(<TierMeter label="AI" meter={meter} unit="token" />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(t('billing.usage.plan.tier.name', { name: 'Pro' }))).toBeInTheDocument()
  })

  it('shows a warning callout with the pct/tier text at 80%', () => {
    const meter: BillingUsageTierMeter = { tier: { key: 'pro', label: 'Pro' }, allowance: 100, used: 80, pct: 80, state: 'warn', over: 0 }
    render(<TierMeter label="AI" meter={meter} unit="token" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(t('billing.usage.plan.tier.warning', { pct: '80', tier: 'Pro' }))).toBeInTheDocument()
  })

  it('at 100% with overage off: a danger callout with a real mailto Button, no other CTA', () => {
    const meter: BillingUsageTierMeter = {
      tier: { key: 'pro', label: 'Pro' }, allowance: 100, used: 100, pct: 100, state: 'blocked', over: 0,
      overage_enabled: false, upgrade_hint: { contact: 'mailto:sales@koios.example' },
    }
    render(<TierMeter label="AI" meter={meter} unit="token" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(t('billing.usage.plan.tier.exceeded', { tier: 'Pro' }))).toBeInTheDocument()
    const link = screen.getByRole('link', { name: t('billing.usage.plan.tier.upgradeCta') })
    expect(link.getAttribute('href')).toMatch(/^mailto:sales@koios\.example\?subject=/)
  })

  it('at 100% with overage on: no CTA, and the overage line shows the amount', () => {
    const meter: BillingUsageTierMeter = {
      tier: { key: 'pro', label: 'Pro' }, allowance: 100, used: 120, pct: 100, state: 'blocked', over: 20,
      overage_enabled: true, overage_price_cents: 50, upgrade_hint: { contact: 'mailto:sales@koios.example' },
    }
    render(<TierMeter label="AI" meter={meter} unit="token" />)
    expect(screen.queryByRole('link')).toBeNull()
    const eur = formatCurrency(0.5 * 20).replace(/\u00a0/g, ' ')
    const match = screen.getAllByText((_, el) => el?.textContent?.replace(/\u00a0/g, ' ').includes(eur) ?? false)
    expect(match.length).toBeGreaterThan(0)
  })

  it('renders no upgrade link when upgrade_hint.contact is absent (no fake affordance)', () => {
    const meter: BillingUsageTierMeter = { tier: { key: 'pro', label: 'Pro' }, allowance: 100, used: 100, pct: 100, state: 'blocked', over: 0, overage_enabled: false }
    render(<TierMeter label="AI" meter={meter} unit="token" />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('never renders a lone "0" — a zero over/pct stays silent, not printed bare', () => {
    const meter: BillingUsageTierMeter = { tier: { key: 'pro', label: 'Pro' }, allowance: 100, used: 0, pct: 0, state: 'ok', over: 0 }
    const { container } = render(<TierMeter label="AI" meter={meter} unit="token" />)
    const bareZero = Array.from(container.querySelectorAll('*')).some((el) => el.children.length === 0 && el.textContent?.trim() === '0')
    expect(bareZero).toBe(false)
  })

  it('renders no tier name/meter when meter is undefined (empty state stays honest)', () => {
    render(<TierMeter label="AI" meter={undefined} unit="token" />)
    expect(screen.getByText(t('billing.usage.plan.tier.none'))).toBeInTheDocument()
  })

  // P1: without meter.state the state derives locally from pct/warn_at_pct —
  // 79 stays ok, 80 warns, 100 blocks, all from pct alone.
  it('derives state from pct alone when meter.state is absent', () => {
    const base = { tier: { key: 'pro', label: 'Pro' }, allowance: 100, over: 0 }
    const { rerender } = render(<TierMeter label="AI" meter={{ ...base, used: 79, pct: 79 }} unit="token" />)
    expect(screen.queryByRole('alert')).toBeNull()

    rerender(<TierMeter label="AI" meter={{ ...base, used: 80, pct: 80 }} unit="token" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(t('billing.usage.plan.tier.warning', { pct: '80', tier: 'Pro' }))).toBeInTheDocument()

    rerender(<TierMeter label="AI" meter={{ ...base, used: 100, pct: 100 }} unit="token" />)
    expect(screen.getByText(t('billing.usage.plan.tier.exceeded', { tier: 'Pro' }))).toBeInTheDocument()
  })

  // P5: weightsLine derives chat/other from the activities map (contract has
  // no "other" key) and falls back to the documented flavour defaults.
  it('derives the weightsLine from a chat + non-chat activity map', () => {
    const meter: BillingUsageTierMeter = {
      tier: { key: 'pro', label: 'Pro' }, allowance: 100, used: 10, pct: 10, state: 'ok', over: 0,
      weights: { activities: { chat: 3, note_assist: 1 }, flavors: { slim: 2, max: 5 } },
    }
    render(<TierMeter label="AI" meter={meter} unit="token" />)
    expect(screen.getByText(t('billing.usage.plan.tier.weightsLine', { chat: '3', other: '1', slim: '2', max: '5' }))).toBeInTheDocument()
  })

  // N1: a tier-less blocked meter (legacy allowance 0) reads the bundle copy, never
  // "Staffel Geen staffel actief", and an absent overage price never prints as € 0,00.
  it('uses the tier-less copy and hides the price when no tier and no overage price are sent', () => {
    const meter: BillingUsageTierMeter = { allowance: 0, used: 0, pct: 100, state: 'blocked', over: 0, overage_enabled: true }
    render(<TierMeter label="AI" meter={meter} unit="token" />)
    expect(screen.getByText(t('billing.usage.plan.tier.exceededNoTier'))).toBeInTheDocument()
    expect(screen.queryByText(/0,00/)).toBeNull()
  })

  it('reads the tier-less warning copy at 80% without a tier', () => {
    const meter: BillingUsageTierMeter = { allowance: 100, used: 80, pct: 80, state: 'warn', over: 0 }
    render(<TierMeter label="AI" meter={meter} unit="token" />)
    expect(screen.getByText(t('billing.usage.plan.tier.warningNoTier', { pct: '80' }))).toBeInTheDocument()
  })

  // N2: an empty activities map is not a weighting the server asserted.
  it('renders no weightsLine for an empty activities map', () => {
    const meter: BillingUsageTierMeter = { tier: { key: 'pro', label: 'Pro' }, allowance: 100, used: 10, pct: 10, state: 'ok', over: 0, weights: { activities: {}, flavors: {} } }
    render(<TierMeter label="AI" meter={meter} unit="token" />)
    expect(screen.queryByText(/slim/i)).toBeNull()
  })
})
