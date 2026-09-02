/**
 * TenantUsageKpiRow — the one component that renders the MARGEGEHEIM fields
 * (purchase/margin, superadmin-only screen): pins that they land in the AI
 * tile's note, and that missing values read as a dash, never a fabricated
 * € 0,00 (Opus round, TENANT-USAGE-POLISH-1).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TenantUsageKpiRow from './TenantUsageKpiRow'

// House pattern (see WorkflowHistoryView.test): mock BOTH react-i18next and
// @/i18n — importing the real @/i18n self-initialises i18next as a side effect.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const vals = o ? Object.entries(o).filter(([kk]) => kk !== 'defaultValue').map(([, v]) => v) : []
      return vals.length ? `${k}:${vals.join('|')}` : k
    },
    i18n: { language: 'nl' },
  }),
}))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))

describe('TenantUsageKpiRow', () => {
  it('renders purchase, sale and margin in the AI tile note', () => {
    render(<TenantUsageKpiRow loading={false} usage={{
      ai: { tokens: 13122, requests: 5 },
      billing: { ai: { purchase: 12.34, sale: 19.75, margin: 7.41 } },
      workflow_tokens: { total_module_runs: 1 },
      whatsapp: { business_numbers: 2 },
      planning: { processed_hours: 10 },
    }} />)
    const notes = document.body.textContent ?? ''
    expect(notes).toMatch(/12,34|12.34/)   // purchase in the AI note
    expect(notes).toMatch(/7,41|7.41/)     // margin in the AI note
    expect(notes).toMatch(/19,75|19.75/)   // sale as the tile value
  })

  it('renders the billable-of-credits workflow note and the resets_at caption (CREDITS-2-FE deel 3)', () => {
    render(<TenantUsageKpiRow loading={false} usage={{
      ai: { tokens: 100 },
      workflow_tokens: { total_module_runs: 4 },
      // Real shape: the controller merges billingForMonth() under `billing`,
      // so resets_at lives INSIDE it (Opus round, golf 4).
      billing: { workflow: { credits: 620, included_budget: 500, billable_credits: 120, amount: 60 }, resets_at: '2026-09-01T00:00:00Z' },
    }} />)
    const notes = document.body.textContent ?? ''
    expect(notes).toMatch(/120/)
    expect(notes).toMatch(/620/)
    expect(notes).toMatch(/500/)
    expect(notes).toMatch(/01-09-2026/)
  })

  it('renders the over-budget line when billable_credits > 0 (usage-meters)', () => {
    render(<TenantUsageKpiRow loading={false} usage={{
      ai: { tokens: 100 },
      billing: { workflow: { credits: 620, included_budget: 500, billable_credits: 120, amount: 6 } },
    }} />)
    // Pin the SEAM (mutation-proven weak before): the over line is the overBudget
    // KEY itself in the danger ink — deleting the branch must fail this test.
    const over = screen.getByText(/billing\.usage\.plan\.overBudget/)
    expect(over).toHaveStyle({ color: 'var(--color-danger-text)' })
    expect(document.body.textContent).not.toMatch(/withinBudget/)
  })

  // Legacy packages emit included_budget 0 — that means NO budget, never a
  // 0-budget meter painted over-budget in danger (the false-over the audit caught).
  it('renders the honest no-budget caption when included_budget is 0', () => {
    render(<TenantUsageKpiRow loading={false} usage={{
      ai: { tokens: 100 },
      billing: { workflow: { credits: 620, included_budget: 0, billable_credits: 620, amount: 62 } },
    }} />)
    // Both meters (workflow/ai — WhatsApp is retired, K-242) carry no budget
    // in this fixture: each renders the honest caption, none over-budget.
    expect(screen.getAllByText(/budgetStatus\.noBudget/).length).toBe(2)
    expect(document.body.textContent).not.toMatch(/billing\.usage\.plan\.overBudget/)
  })

  it('renders the calm within-budget caption when billable_credits is 0 (usage-meters)', () => {
    render(<TenantUsageKpiRow loading={false} usage={{
      ai: { tokens: 100 },
      billing: { workflow: { credits: 200, included_budget: 500, billable_credits: 0, amount: 0 } },
    }} />)
    expect(document.body.textContent).toMatch(/budgetStatus.withinBudget/)
  })

  it('renders a dash for missing money values, never a fabricated zero', () => {
    render(<TenantUsageKpiRow loading={false} usage={{ ai: { tokens: 100 } }} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/€\s?0,00/)
  })

  // K-242 (02-09): the WhatsApp Tokens meter is retired — `by_channel` is
  // message-count INFO only now (no per-channel tokens/amount, no meter).
  it('renders the WhatsApp channel split as plain message counts, no tokens meter', () => {
    render(<TenantUsageKpiRow loading={false} usage={{
      ai: { tokens: 100 },
      whatsapp: { business_numbers: 2, by_channel: [
        { channel: 'wa_web', label: 'WhatsApp Web', messages: 250 },
        { channel: 'waba', label: 'WABA', messages: 40 },
      ] },
      billing: { workflow: { credits: 10, included_budget: 500, billable_credits: 0, amount: 0 } },
    }} />)
    expect(screen.getByText(/WhatsApp Web: 250/)).toBeInTheDocument()
    expect(screen.getByText(/WABA: 40/)).toBeInTheDocument()
    expect(screen.queryByText(/waTokens|waProviderBilled/)).toBeNull()
  })
})
