/**
 * UsageReport — the Totaal/AI/Workflows switch (RAPPORTEN-CONSOLIDATIE-1).
 * Each position's own report keeps its full existing test coverage in its own
 * file — this file only proves the SWITCH mechanics: the right sub-report
 * renders per position, `initialView` seeds a legacy-route deep link, and
 * switching updates the shareable URL.
 *
 * Totaal leads now (the merged whole-bill overview), so the default-position
 * assertion below moved from 'ai' to 'total'. The two legacy deep links
 * (#reports.ai / #reports.workflows, mapped in reportIds.ts) still resolve to
 * their own position — that is what the initialView tests pin.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Side-effect import: initialises the shared i18next singleton (see
// CustomerStructureReport.test.tsx's identical note).
import '@/i18n'
import UsageReport from './UsageReport'

vi.mock('./UsageOverviewReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="active-report">total:{period}</div> }))
vi.mock('./AiReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="active-report">ai:{period}</div> }))
vi.mock('./WorkflowsReport', () => ({ default: ({ period }: { period: string }) => <div data-testid="active-report">workflows:{period}</div> }))

beforeEach(() => { window.history.replaceState(null, '', '#reports.usage') })

describe('UsageReport — Totaal/AI/Workflows switch', () => {
  it('defaults to the merged total when no initialView is given (the canonical reports.usage route)', () => {
    render(<UsageReport period="month" />)
    expect(screen.getByTestId('active-report').textContent).toBe('total:month')
  })

  it('honours initialView for a legacy-route deep link (reports.workflows)', () => {
    render(<UsageReport period="month" initialView="workflows" />)
    expect(screen.getByTestId('active-report').textContent).toBe('workflows:month')
  })

  it('honours initialView for the other legacy deep link (reports.ai)', () => {
    render(<UsageReport period="month" initialView="ai" />)
    expect(screen.getByTestId('active-report').textContent).toBe('ai:month')
  })

  it('clicking a switch option swaps the rendered sub-report AND updates the shareable URL', async () => {
    const user = userEvent.setup()
    render(<UsageReport period="week" />)
    await user.click(screen.getByRole('radio', { name: 'Workflows' }))
    expect(screen.getByTestId('active-report').textContent).toBe('workflows:week')
    expect(window.location.hash).toBe('#reports.usage?view=workflows')
  })

  it('renders all three positions as a labelled radiogroup', () => {
    render(<UsageReport period="month" />)
    expect(screen.getByRole('radiogroup', { name: 'Verbruikstype' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Totaal' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Koios AI' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Workflows' })).toBeInTheDocument()
  })
})
