/**
 * AccountManagersReport — REPORTS-ACCTMGR-1 follow-up + K-67 compare wiring.
 * Covers: the real GET /reports/accountmanagers data (no more customers-report
 * stand-in), the four UI states, the nine real KPI cards, AND the three compare
 * traps the backend flagged — (1) the months/contract_ending_days overrides
 * reach the SAME single compare request the plain fetch used, never a
 * per-window split; (2) compliance_days/contract_ending_days render ONLY their
 * current side, never a delta; (3) a null delta_pct renders the house dash. Also
 * proves the direction indicator follows the FIGURE's meaning, not the raw sign
 * (renewalsDue/notContacted rising is bad news even though the delta is positive).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AccountManagersReport from './AccountManagersReport'
import type { AccountManagersReportData } from '@/types/analytics'
import i18n from '@/i18n'

// Data layer under test control (loading/error/empty/success — the four UI states).
const mockUseAccountManagersReport = vi.fn()
vi.mock('./useAccountManagersReport', async () => {
  const actual = await vi.importActual<typeof import('./useAccountManagersReport')>('./useAccountManagersReport')
  return { ...actual, useAccountManagersReport: (...args: unknown[]) => mockUseAccountManagersReport(...args) }
})

// Tenant KPI-order settings, controllable per test (RAPPORT-KPI-INSTELBAAR).
const mockSettings = vi.hoisted(() => vi.fn(() => ({} as Record<string, unknown>)))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockSettings() }
})

// The compare call goes through the REAL useReportCompare + axios client — spy
// on it so the compare tests assert the exact request (§13: request, not callback).
const getSpy = vi.fn()
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => getSpy(...args) } }))

const data: AccountManagersReportData = {
  period: 'month', from: '2026-08-01', to: '2026-08-31', compliance_days: 90, contract_ending_days: 30,
  account_managers: [
    { key: 'r1', label: 'Anna de Vries', customers: 7, open_vacancies: 2, filled_positions: 3, opportunities: 1, contract_ending: 2, not_contacted: 1 },
    { key: 'r2', label: 'Bram Jansen', customers: 3, open_vacancies: 1, filled_positions: 0, opportunities: 0, contract_ending: 0, not_contacted: 0 },
  ],
}

// A realistic compare envelope (ReportComparator's own shape): every row field
// diffed into {current,previous,delta,delta_pct}; compliance_days/
// contract_ending_days (SCALAR CONFIG, not metrics) diffed the same way.
const compareEnvelope = {
  report: 'accountmanagers',
  current: { from: '2026-08-01', to: '2026-08-31' },
  previous: { from: '2026-07-01', to: '2026-07-31' },
  compliance_days: { current: 90, previous: 60, delta: 30, delta_pct: 50 },
  contract_ending_days: { current: 30, previous: 30, delta: 0, delta_pct: 0 },
  account_managers: [
    {
      key: 'r1', label: 'Anna de Vries',
      customers: { current: 7, previous: 5, delta: 2, delta_pct: 40 },
      open_vacancies: { current: 4, previous: 2, delta: 2, delta_pct: 100 },
      filled_positions: { current: 3, previous: 1, delta: 2, delta_pct: 200 },
      opportunities: { current: 2, previous: 1, delta: 1, delta_pct: 100 },
      // previous window was ZERO — the null-delta_pct trap.
      contract_ending: { current: 2, previous: 0, delta: 2, delta_pct: null },
      not_contacted: { current: 1, previous: 0, delta: 1, delta_pct: null },
    },
  ],
}

function renderReport() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <AccountManagersReport period="month" />
    </QueryClientProvider>,
  )
}

// Scopes a query to one KPI card, mirroring RecruitersReport.test.tsx: several
// labels also appear as table column headers, so `getAllByText[0]` grabs the
// KPI card (it renders first in DOM order).
const cardValue = (label: string) => within(screen.getAllByText(label)[0].parentElement as HTMLElement)

// Opens the shared ReportCompareControl (a searchable CreatableSelect, never a
// bare <select>) and picks the option with the given translated label. Goes
// through userEvent (not raw fireEvent) so the resulting query-enabling state
// update — and the mocked axios promise it triggers — resolves inside a
// properly awaited `act()`, never a dangling unawaited microtask.
async function pickCompareMode(user: ReturnType<typeof userEvent.setup>, optionLabel: string) {
  const trigger = screen.getByText(i18n.t('compare.mode.off', { ns: 'analytics' })).closest('button') as HTMLElement
  await user.click(trigger)
  await user.click(screen.getByText(optionLabel))
}

describe('AccountManagersReport — real data (GET /reports/accountmanagers)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: compareEnvelope })
    mockSettings.mockReturnValue({})
    mockUseAccountManagersReport.mockReturnValue({ data, loading: false, error: false, refetch: vi.fn() })
  })

  it('shows the loading state', () => {
    mockUseAccountManagersReport.mockReturnValue({ data: null, loading: true, error: false, refetch: vi.fn() })
    renderReport()
    expect(screen.getByText('Accountmanagers laden…')).toBeInTheDocument()
  })

  it('shows the error state and retries via the hook refetch', async () => {
    const refetch = vi.fn()
    mockUseAccountManagersReport.mockReturnValue({ data: null, loading: false, error: true, refetch })
    renderReport()
    expect(screen.getByText('Kon de accountmanagers niet laden')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Probeer opnieuw' }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state when there are no account managers', () => {
    mockUseAccountManagersReport.mockReturnValue({ data: { ...data, account_managers: [] }, loading: false, error: false, refetch: vi.fn() })
    renderReport()
    expect(screen.getByText('Geen accountmanagers in deze periode')).toBeInTheDocument()
  })

  it('renders one table row per account manager from the real endpoint, not the customers-report stand-in', () => {
    renderReport()
    expect(screen.getByText('Anna de Vries')).toBeInTheDocument()
    expect(screen.getByText('Bram Jansen')).toBeInTheDocument()
  })

  it('renders exactly nine real KPI cards — no permanent dashes now the data exists', () => {
    renderReport()
    // Team totals: customers 7+3=10, open_vacancies 2+1=3, filled_positions 3+0=3,
    // opportunities 1+0=1, contract_ending 2+0=2, not_contacted 1+0=1, managers=2.
    expect(cardValue('Accountmanagers').getByText('2')).toBeInTheDocument()
    expect(cardValue('Klanten in periode').getByText('10')).toBeInTheDocument()
    expect(cardValue('Gem. klanten per manager').getByText('5')).toBeInTheDocument()
    expect(cardValue('Top manager').getByText('Anna de Vries · 7')).toBeInTheDocument()
    expect(cardValue('Open vacatures').getByText('3')).toBeInTheDocument()
    expect(cardValue('Vervulde plaatsingen').getByText('3')).toBeInTheDocument()
    expect(cardValue('Kansen').getByText('1')).toBeInTheDocument()
    expect(cardValue('Verlengingen te doen').getByText('2')).toBeInTheDocument()
    expect(cardValue('Niet benaderd').getByText('1')).toBeInTheDocument()
    // The house rule ("EXACTLY NINE KPI cards") — no dash placeholders remain.
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('shows the not-contacted/contract-ending thresholds actually applied, read from the plain report', () => {
    renderReport()
    expect(screen.getByText(/> 90 d/)).toBeInTheDocument()
    expect(screen.getByText(/≤ 30 d/)).toBeInTheDocument()
  })
})

describe('AccountManagersReport — compare wiring (K-67)', () => {
  beforeEach(() => {
    getSpy.mockReset()
    getSpy.mockResolvedValue({ data: compareEnvelope })
    mockSettings.mockReturnValue({})
    mockUseAccountManagersReport.mockReturnValue({ data, loading: false, error: false, refetch: vi.fn() })
  })

  it('sends `compare` for a preset window with the report\'s own resolved from/to', async () => {
    const user = userEvent.setup()
    renderReport()
    await pickCompareMode(user, i18n.t('compare.mode.previous_period', { ns: 'analytics' }))
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith('/reports/accountmanagers/compare', expect.objectContaining({
      params: { from: '2026-08-01', to: '2026-08-31', compare: 'previous_period' },
    })))
  })

  it('sends compare_from/compare_to for a custom range — never a `compare` key alongside it', async () => {
    const user = userEvent.setup()
    renderReport()
    await pickCompareMode(user, i18n.t('compare.mode.custom', { ns: 'analytics' }))
    fireEvent.change(screen.getByLabelText(i18n.t('compare.customFrom', { ns: 'analytics' })), { target: { value: '2025-01-01' } })
    fireEvent.change(screen.getByLabelText(i18n.t('compare.customTo', { ns: 'analytics' })), { target: { value: '2025-01-31' } })
    await waitFor(() => expect(getSpy.mock.calls.some(c => c[0] === '/reports/accountmanagers/compare')).toBe(true))
    const call = getSpy.mock.calls.find(c => c[0] === '/reports/accountmanagers/compare')
    expect(call?.[1].params).toEqual({ from: '2026-08-01', to: '2026-08-31', compare_from: '2025-01-01', compare_to: '2025-01-31' })
    expect(call?.[1].params).not.toHaveProperty('compare')
  })

  // TRAP 1: months/contract_ending_days are set ONCE and must reach the plain
  // fetch AND the single compare request identically — never a per-window split.
  it('the months/contract_ending_days overrides reach the plain fetch AND the one compare request, never split per window', async () => {
    const user = userEvent.setup()
    renderReport()

    await user.type(screen.getByLabelText('Niet benaderd na (maanden)'), '3')
    await user.type(screen.getByLabelText('Contract eindigt binnen (dagen)'), '45')
    await pickCompareMode(user, i18n.t('compare.mode.previous_period', { ns: 'analytics' }))
    await waitFor(() => expect(getSpy.mock.calls.some(c => c[0] === '/reports/accountmanagers/compare')).toBe(true))

    // The plain report hook received the SAME override values.
    const lastPlainCall = mockUseAccountManagersReport.mock.calls.at(-1)
    expect(lastPlainCall?.[1]).toEqual({ months: 3, contractEndingDays: 45 })

    // The ONE compare request carries both keys — proving the backend applies
    // them to both windows from a single shared params object, never two calls.
    const compareCall = getSpy.mock.calls.find(c => c[0] === '/reports/accountmanagers/compare')
    expect(compareCall?.[1].params).toEqual(expect.objectContaining({ months: 3, contract_ending_days: 45 }))
    expect(getSpy.mock.calls.filter(c => c[0] === '/reports/accountmanagers/compare').length).toBe(1)
  })

  // TRAP 2: compliance_days/contract_ending_days are an ECHO of the setting
  // applied, not a metric — only `.current` (90/30) ever renders, never the
  // previous (60) or the delta (+30/50%).
  it('renders the scalar configuration values (compliance_days, contract_ending_days) with only their current side, no delta', async () => {
    const user = userEvent.setup()
    renderReport()
    await pickCompareMode(user, i18n.t('compare.mode.previous_period', { ns: 'analytics' }))
    const thresholds = await screen.findByText(/niet benaderd na 90 dagen/i)
    expect(thresholds).toHaveTextContent('contract eindigt binnen 30 dagen')
    // The previous/delta values for these two scalars must never leak into the UI.
    expect(thresholds).not.toHaveTextContent('60')
    expect(thresholds).not.toHaveTextContent('50%')
    expect(thresholds).not.toHaveTextContent('+30')
  })

  // TRAP 3: previous window was zero for contract_ending/not_contacted — the
  // house dash, never "0%"/Infinity, reused straight from the shared component.
  it('renders the house dash for a null delta_pct (previous window was zero)', async () => {
    const user = userEvent.setup()
    renderReport()
    await pickCompareMode(user, i18n.t('compare.mode.previous_period', { ns: 'analytics' }))
    await waitFor(() => expect(cardValue('Verlengingen te doen').getByText('—')).toBeInTheDocument())
    expect(cardValue('Niet benaderd').getByText('—')).toBeInTheDocument()
  })

  // Direction follows the FIGURE's meaning, never the raw sign — mirrors
  // reportComparePolarity.ts, reused as-is (the mechanism already exists and is
  // already tested generically; this proves THIS report wires it correctly).
  it('colours a rising up-good figure (customers) green, a rising down-good figure (renewalsDue) red — not by raw sign', async () => {
    const user = userEvent.setup()
    renderReport()
    await pickCompareMode(user, i18n.t('compare.mode.previous_period', { ns: 'analytics' }))
    await waitFor(() => expect(cardValue('Klanten in periode').getByText('+2')).toBeInTheDocument())

    // customers: delta +2, up-good → good news → success token.
    const customersDelta = cardValue('Klanten in periode').getByText('+2')
    expect(customersDelta.parentElement).toHaveStyle({ color: 'var(--color-success)' })

    // renewalsDue (contract_ending): delta +2, down-good → MORE contracts due to
    // end soon is NOT good news even though the delta is positive — the exact
    // "more rejections rising" trap, applied to this report's own attention metric.
    const renewalsDelta = cardValue('Verlengingen te doen').getByText('+2')
    expect(renewalsDelta.parentElement).toHaveStyle({ color: 'var(--color-danger)' })

    // notContacted: delta +1, down-good → also bad news, not green.
    const notContactedDelta = cardValue('Niet benaderd').getByText('+1')
    expect(notContactedDelta.parentElement).toHaveStyle({ color: 'var(--color-danger)' })

    // openVacancies: delta +2, but this figure's meaning is genuinely ambiguous
    // (more open demand is neither clearly good nor bad) — neutral, never a
    // colour claim, even though the raw delta is positive.
    const openVacDelta = cardValue('Open vacatures').getByText('+2')
    expect(openVacDelta.parentElement).toHaveStyle({ color: 'var(--text-muted)' })
  })
})
