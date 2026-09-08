/**
 * TierCatalogTable tests (props-only presenter) — per-meter headers, kit fields
 * (grouped volume, euro price with cents on the wire), no native <select>.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import TierCatalogTable from './TierCatalogTable'
import type { BillingAiTier, BillingWorkflowTier } from '@/types/billingTiers'

const st = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'settings', ...opts })

const aiRows: BillingAiTier[] = [
  { key: 'start', label: 'AI Start', monthly_tokens: 3000, price_cents: 9900, sort: 1, active: true, in_use: 2 },
  { key: 'pro', label: 'AI Pro', monthly_tokens: 10000, price_cents: 29900, sort: 2, active: true, in_use: 0 },
]
const workflowRows: BillingWorkflowTier[] = [
  { key: 'start', label: 'Workflow Start', monthly_runs: 5000, price_cents: 4900, sort: 1, active: true, in_use: 1 },
]

describe('TierCatalogTable', () => {
  it('renders the AI header, a grouped volume and the price in euros', () => {
    render(<TierCatalogTable meter="ai" rows={aiRows} onChange={vi.fn()} />)
    expect(screen.getByText(st('billingTiers.colIncludedTokens'))).toBeInTheDocument()
    expect(screen.getByLabelText(`${st('billingTiers.colIncludedTokens')}: AI Pro`)).toHaveValue('10.000')
    expect(screen.getByLabelText(`${st('billingTiers.colPrice')}: AI Pro`)).toHaveValue('299,00')
    expect(screen.getAllByText(st('billingTiers.perMonth'))).toHaveLength(2)
  })

  it('hands an edited euro price up as cents', () => {
    const onChange = vi.fn()
    render(<TierCatalogTable meter="ai" rows={aiRows} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(`${st('billingTiers.colPrice')}: AI Pro`), { target: { value: '349,50' } })
    expect(onChange).toHaveBeenCalledWith('pro', { price_cents: 34950 })
  })

  it('renders the workflow header', () => {
    render(<TierCatalogTable meter="workflow" rows={workflowRows} onChange={vi.fn()} />)
    expect(screen.getByText(st('billingTiers.colIncludedRuns'))).toBeInTheDocument()
    expect(screen.queryByText(st('billingTiers.colIncludedTokens'))).not.toBeInTheDocument()
  })

  it('never renders a native select', () => {
    const { container } = render(<TierCatalogTable meter="ai" rows={aiRows} onChange={vi.fn()} />)
    expect(container.querySelectorAll('select')).toHaveLength(0)
  })

  it('renders in_use as text', () => {
    render(<TierCatalogTable meter="ai" rows={aiRows} onChange={vi.fn()} />)
    expect(screen.getByText(st('billingTiers.inUseValue', { count: 2 }))).toBeInTheDocument()
  })
})
