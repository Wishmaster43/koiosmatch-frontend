/**
 * TenantUsageSettings — SA-USAGE-SUBTABS-1 (Danny 24-08): kpis / monthly /
 * breakdown sub-tabs, same SubTabBar idiom as ModulesSettings. Covers tab
 * order, default tab, tab-switch content, and that the period (month) state
 * survives a tab switch (shared state stays above the tabs).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/react'
import TenantUsageSettings from './TenantUsageSettings'

const mockGet = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...a) => mockGet(...a) }, unwrap: (res) => res?.data }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeTenant: { id: 't1', name: 'Yesway Flex' } }) }))
// Breakdown table fetches its own data independently; stub it out so this
// suite only exercises the tab shell + shared state.
vi.mock('./TenantUsageBreakdownTable', () => ({ default: ({ month }) => <div data-testid="breakdown-table">{month}</div> }))

beforeEach(() => {
  mockGet.mockReset()
  mockGet.mockResolvedValue({ data: { ai: { tokens: 10, requests: 2 }, connectors: [], history: [] } })
})

describe('TenantUsageSettings — subtabs', () => {
  it('renders the three tabs in order kpis, monthly, breakdown', async () => {
    render(<TenantUsageSettings />)
    const tabs = await screen.findAllByRole('tab')
    expect(tabs.map(t => t.textContent)).toEqual(['usage.tabs.kpis', 'usage.tabs.monthly', 'usage.tabs.breakdown'])
  })

  it('defaults to the kpis tab', async () => {
    render(<TenantUsageSettings />)
    const kpisTab = await screen.findByRole('tab', { name: 'usage.tabs.kpis' })
    expect(kpisTab).toHaveAttribute('aria-selected', 'true')
    // Connectors card only renders on the kpis tab.
    await waitFor(() => expect(screen.getByText('usage.col.connectors')).toBeInTheDocument())
    expect(screen.queryByText('usage.details.title')).not.toBeInTheDocument()
    expect(screen.queryByText('usage.breakdown.title')).not.toBeInTheDocument()
  })

  it('clicking monthly shows the details table, clicking breakdown shows the breakdown table', async () => {
    render(<TenantUsageSettings />)
    await screen.findByText('usage.col.connectors')

    await userEvent.click(screen.getByRole('tab', { name: 'usage.tabs.monthly' }))
    expect(screen.getByText('usage.details.title')).toBeInTheDocument()
    expect(screen.queryByText('usage.col.connectors')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'usage.tabs.breakdown' }))
    expect(screen.getByText('usage.breakdown.title')).toBeInTheDocument()
    expect(screen.queryByText('usage.details.title')).not.toBeInTheDocument()
  })

  it('switching tabs preserves the selected month (shared state survives)', async () => {
    render(<TenantUsageSettings />)
    await screen.findByText('usage.col.connectors')

    // Pick a month via the trigger button (renders the current label initially).
    const monthTrigger = screen.getByRole('button')
    const initialLabel = monthTrigger.textContent
    await userEvent.click(monthTrigger)
    // The option list renders as buttons too (SearchSelect); pick one that
    // differs from the currently selected month so the change is observable.
    const options = await screen.findAllByRole('button')
    const otherMonth = options.find(o => o !== monthTrigger && o.textContent && o.textContent !== initialLabel)
    await userEvent.click(otherMonth)
    const chosenLabel = otherMonth.textContent

    await userEvent.click(screen.getByRole('tab', { name: 'usage.tabs.breakdown' }))
    await userEvent.click(screen.getByRole('tab', { name: 'usage.tabs.kpis' }))

    expect(screen.getByRole('button').textContent).toBe(chosenLabel)
  })
})
