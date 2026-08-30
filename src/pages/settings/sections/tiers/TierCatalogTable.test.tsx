/**
 * TierCatalogTable tests (props-only presenter) — per-meter headers, no native
 * <select> in the DOM, and the cents caption rendering "= € 299,00".
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  // AI meter renders the tokens header and the € caption for its price.
  it('renders the AI header and the cents-to-euro caption', () => {
    render(<TierCatalogTable meter="ai" rows={aiRows} onChange={vi.fn()} />)
    expect(screen.getByText(st('billingTiers.colIncludedTokens'))).toBeInTheDocument()
    expect(screen.getByText(st('billingTiers.priceCaption', { amount: '€ 299,00' }))).toBeInTheDocument()
  })

  // Workflow meter renders the runs header instead of the tokens header.
  it('renders the workflow header', () => {
    render(<TierCatalogTable meter="workflow" rows={workflowRows} onChange={vi.fn()} />)
    expect(screen.getByText(st('billingTiers.colIncludedRuns'))).toBeInTheDocument()
    expect(screen.queryByText(st('billingTiers.colIncludedTokens'))).not.toBeInTheDocument()
  })

  // No native <select> anywhere in the rendered table (CLAUDE.md §3A).
  it('never renders a native select', () => {
    const { container } = render(<TierCatalogTable meter="ai" rows={aiRows} onChange={vi.fn()} />)
    expect(container.querySelectorAll('select')).toHaveLength(0)
  })

  // in_use renders as plain text, never a decorative dot.
  it('renders in_use as text', () => {
    render(<TierCatalogTable meter="ai" rows={aiRows} onChange={vi.fn()} />)
    expect(screen.getByText(st('billingTiers.inUseValue', { count: 2 }))).toBeInTheDocument()
  })
})
