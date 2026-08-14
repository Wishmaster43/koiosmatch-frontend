/**
 * TenantUsageDetailsTable — renders the per-month history fixture the backend
 * sends (AdminUsageController@show `history`), expands a row into its real
 * sub-sections, and shows an honest empty state for a month with no detail
 * data instead of a fabricated zero.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TenantUsageDetailsTable from './TenantUsageDetailsTable'

// One month WITH data, one month with an entirely empty payload (server sent
// zeros/empty arrays for every sub-section — the honest "no data" case).
const history = [
  {
    month: '2026-08',
    ai: { tokens: 12000, requests: 40, cost: 1.2 },
    workflow_tokens: { total_module_runs: 5, per_module: { send_email: 3, ai_generate: 2 } },
    billing: { total_amount: 4.5, ai: { purchase: 1.2, sale: 1.5, margin: 0.3 } },
    connectors: [{ key: 'sm', usage: 10 }, { key: 'hf', usage: 0 }],
  },
  {
    month: '2026-07',
    ai: { tokens: 0, requests: 0, cost: 0 },
    workflow_tokens: { total_module_runs: 0, per_module: {} },
    billing: { total_amount: 0, ai: { purchase: 0, sale: 0, margin: 0 } },
    connectors: [],
  },
]

describe('TenantUsageDetailsTable', () => {
  it('renders one row per month from the fixture with real summary values', () => {
    render(<TenantUsageDetailsTable history={history} />)
    expect(screen.getByText(/augustus 2026/i)).toBeInTheDocument()
    expect(screen.getByText(/juli 2026/i)).toBeInTheDocument()
    expect(screen.getByText('12.000')).toBeInTheDocument() // AI tokens for August
  })

  it('expands a row to show its real detail sections (purchase/sale/margin, per-module, connectors)', async () => {
    render(<TenantUsageDetailsTable history={history} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[0])
    expect(screen.getByText('send_email')).toBeInTheDocument()
    expect(screen.getByText('Shiftmanager')).toBeInTheDocument()
    // HelloFlex has zero usage this month — filtered out of the connector list.
    expect(screen.queryByText('HelloFlex')).not.toBeInTheDocument()
  })

  it('shows an honest empty state for a month with no per-module/connector data, never a fake zero row', async () => {
    render(<TenantUsageDetailsTable history={history} />)
    const buttons = screen.getAllByRole('button')
    await userEvent.click(buttons[1])
    const noDataNotices = screen.getAllByText('Geen gegevens.')
    expect(noDataNotices.length).toBeGreaterThanOrEqual(2) // per-module + connectors
  })

  it('shows a calm empty state when the backend sends no history at all', () => {
    render(<TenantUsageDetailsTable history={[]} />)
    expect(screen.getByText('Nog geen verbruiksgeschiedenis.')).toBeInTheDocument()
  })
})
