/**
 * TierPlatformTogglesCard tests (props-only presenter) — kit rows per meter, no
 * native <select>, and a disabled euro price field when its meter's overage is off.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import TierPlatformTogglesCard from './TierPlatformTogglesCard'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

describe('TierPlatformTogglesCard', () => {
  it('renders both overage meters and the warn-percentage knob', () => {
    render(
      <TierPlatformTogglesCard
        overage={{ ai_enabled: true, ai_price_cents: 5, workflow_enabled: false, workflow_price_cents: 2 }}
        warnAtPct={80} onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('switch', { name: `${st('billingTiers.overageEnabled')}: ${st('billing.usage.plan.tier.aiTitle')}` })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: `${st('billingTiers.overageEnabled')}: ${st('billing.usage.plan.tier.workflowTitle')}` })).toBeInTheDocument()
    expect(screen.getByLabelText(st('billingTiers.warnPctLabel'))).toHaveValue('80')
  })

  it('shows the price in euros, disables it while the meter is off, and hands cents back', () => {
    const onChange = vi.fn()
    render(
      <TierPlatformTogglesCard
        overage={{ ai_enabled: false, ai_price_cents: 5, workflow_enabled: true, workflow_price_cents: 250 }}
        onChange={onChange}
      />,
    )
    const aiPrice = screen.getByLabelText(st('billingTiers.overageAiPrice'), { exact: false })
    const wfPrice = screen.getByLabelText(st('billingTiers.overageWorkflowPrice'), { exact: false })
    expect(aiPrice).toBeDisabled()
    expect(aiPrice).toHaveValue('0,05')
    expect(wfPrice).not.toBeDisabled()
    expect(wfPrice).toHaveValue('2,50')
    expect(screen.getAllByText(st('billingTiers.overageOffCaption'))).toHaveLength(1)
    fireEvent.change(wfPrice, { target: { value: '3,00' } })
    expect(onChange).toHaveBeenCalledWith({ overage: { workflow_price_cents: 300 } })
  })

  it('never renders a native select', () => {
    const { container } = render(<TierPlatformTogglesCard overage={{}} onChange={vi.fn()} />)
    expect(container.querySelectorAll('select')).toHaveLength(0)
  })
})
