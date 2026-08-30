/**
 * TierPackageIncludesCard tests (props-only presenter) — the runs input and
 * the AI-tier SearchSelect pick, no native <select>.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import TierPackageIncludesCard from './TierPackageIncludesCard'
import type { BillingAiTier } from '@/types/billingTiers'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const aiTiers: BillingAiTier[] = [
  { key: 'assist', label: 'Assist', active: true },
  { key: 'pro', label: 'Pro', active: true },
  { key: 'max', label: 'Max', active: false },
]

describe('TierPackageIncludesCard', () => {
  // Each of the three packages renders its own runs field.
  it('renders one runs input per package', () => {
    render(<TierPackageIncludesCard baselines={{}} aiTiers={aiTiers} onChange={vi.fn()} />)
    expect(screen.getAllByLabelText(st('billingTiers.includesRuns'))).toHaveLength(3)
  })

  // Editing the runs number for one package calls onChange for that package only.
  it('calls onChange with the edited runs number', () => {
    const onChange = vi.fn()
    render(<TierPackageIncludesCard baselines={{}} aiTiers={aiTiers} onChange={onChange} />)
    const [coreRuns] = screen.getAllByLabelText(st('billingTiers.includesRuns'))
    fireEvent.change(coreRuns, { target: { value: '50' } })
    expect(onChange).toHaveBeenCalledWith('core', { workflow_runs: 50 })
  })

  // Picking "Geen AI" clears the package's baseline tier to null.
  it('calls onChange with ai_tier_key:null when "Geen AI" is chosen', () => {
    const onChange = vi.fn()
    render(<TierPackageIncludesCard baselines={{ core: { ai_tier_key: 'pro' } }} aiTiers={aiTiers} onChange={onChange} />)
    fireEvent.click(screen.getAllByLabelText(st('billingTiers.includesAiTier'), { exact: false })[0])
    fireEvent.click(screen.getByRole('button', { name: st('billingTiers.includesAiNone') }))
    expect(onChange).toHaveBeenCalledWith('core', { ai_tier_key: null })
  })

  // Inactive tiers never appear as a pickable option.
  it('excludes inactive AI tiers from the option list', () => {
    render(<TierPackageIncludesCard baselines={{}} aiTiers={aiTiers} onChange={vi.fn()} />)
    fireEvent.click(screen.getAllByLabelText(st('billingTiers.includesAiTier'), { exact: false })[0])
    expect(screen.queryByText('Max')).not.toBeInTheDocument()
  })

  // No native <select> anywhere.
  it('never renders a native select', () => {
    const { container } = render(<TierPackageIncludesCard baselines={{}} aiTiers={aiTiers} onChange={vi.fn()} />)
    expect(container.querySelectorAll('select')).toHaveLength(0)
  })
})
