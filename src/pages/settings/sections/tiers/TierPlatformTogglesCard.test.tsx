/**
 * TierPlatformTogglesCard tests (props-only presenter) — no native <select>,
 * and a disabled price input when its meter's overage toggle is off.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import TierPlatformTogglesCard from './TierPlatformTogglesCard'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

describe('TierPlatformTogglesCard', () => {
  // Both meter labels and the shared knobs render.
  it('renders both overage rows and the shared knobs', () => {
    render(
      <TierPlatformTogglesCard
        overage={{ ai_enabled: true, ai_price_cents: 5, workflow_enabled: false, workflow_price_cents: 2 }}
        warnAtPct={80} upgradeContact="mailto:sales@koiosmatch.nl" onChange={vi.fn()}
      />,
    )
    // F3: the container prints the section heading now, not this card — assert
    // the per-meter GroupLabels it does own instead.
    expect(screen.getByText(st('billing.usage.plan.tier.aiTitle'))).toBeInTheDocument()
    expect(screen.getByText(st('billing.usage.plan.tier.workflowTitle'))).toBeInTheDocument()
    expect(screen.getByLabelText(st('billingTiers.warnPctLabel'))).toBeInTheDocument()
    expect(screen.getByLabelText(st('billingTiers.upgradeContactLabel'))).toBeInTheDocument()
  })

  // Off meter shows the caption and its price input is disabled.
  it('disables the price input and shows the caption when a meter is off', () => {
    render(
      <TierPlatformTogglesCard
        overage={{ ai_enabled: false, ai_price_cents: 5, workflow_enabled: true, workflow_price_cents: 2 }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(st('billingTiers.overageAiPrice'))).toBeDisabled()
    expect(screen.getByLabelText(st('billingTiers.overageWorkflowPrice'))).not.toBeDisabled()
    expect(screen.getAllByText(st('billingTiers.overageOffCaption'))).toHaveLength(1)
  })

  // No native <select> anywhere.
  it('never renders a native select', () => {
    const { container } = render(
      <TierPlatformTogglesCard overage={{}} onChange={vi.fn()} />,
    )
    expect(container.querySelectorAll('select')).toHaveLength(0)
  })
})
