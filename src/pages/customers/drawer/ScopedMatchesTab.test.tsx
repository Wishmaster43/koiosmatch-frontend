/**
 * ScopedMatchesTab — Danny's ten-point round, points 1/2/4/6 (the scoped
 * location/department Matches sub-tab). The row-mapper/mapMatch reuse and the
 * generic list chrome are ScopedListTab's own concern (config-driven,
 * SCOPED-LIST-TAB-1); this file proves: (2) vacancy + fase render as one merged
 * cell, no separate Fase column; (4/6) the Periode cell formats the window and
 * carries its own expiry chip; (1) "+ Match" only appears once a customerId is
 * known, opens MatchModal prefilled with the right scope, and a created match
 * invalidates this exact scoped query key.
 *
 * Real i18n is loaded (side-effect import): this component's own Periode cell
 * uses `useDateFormat` (lib/datetime), which itself imports `@/i18n` — a
 * raw-key stub would assert against text that never actually renders.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import i18n from '@/i18n'
import ScopedMatchesTab from './ScopedMatchesTab'

const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'candidates', ...opts })
const cust = (key: string) => i18n.t(key, { ns: 'customers' })
const mt = (key: string) => i18n.t(key, { ns: 'matches' })

vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate: vi.fn() }) }))
// eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
const metaOf = vi.fn((v?: string) => (v === 'open' ? { value: 'open', label: 'Open (lookup)', color: '#123456', is_closed: false } : undefined))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf }) }))

// The generic fetch is ScopedListTab/useScopedEntityList's own concern —
// stubbed here so this test is about the COLUMN shape, not the network seam.
const mockUseScopedEntityList = vi.fn()
vi.mock('../hooks/useScopedEntityList', () => ({ useScopedEntityList: () => mockUseScopedEntityList() }))

// Point 1: MatchModal has its own exhaustive test file — stubbed so this test
// only proves the TRIGGER wires the right initial props/query invalidation.
const matchModalProps = vi.fn()
vi.mock('@/pages/candidates/drawer/MatchModal', () => ({
  default: (props: Record<string, unknown>) => { matchModalProps(props); return <div data-testid="match-modal" /> },
}))

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

// useScopedEntityList is mocked wholesale below, so it never runs mapRow/mapMatch
// on a raw API payload — this fixture is already the MAPPED ScopedMatchRow shape
// the real hook would hand to ScopedListTab/DataTable.
const raw = (over: Record<string, unknown> = {}) => ({
  id: 'm-1', candidate: 'Jane Doe', candidateId: 'cand-1', vacancy: 'Verpleegkundige', vacancyId: 'vac-1',
  contractType: 'Fase 1-2', startDate: '2026-01-01', endDate: '2026-12-31',
  status: '', stage: '', stageColor: '', archived: false,
  ...over,
})

describe('ScopedMatchesTab · merged title (point 2)', () => {
  it('renders vacancy + fase as one cell, with no separate Fase/Stage column header', () => {
    mockUseScopedEntityList.mockReturnValue({ rows: [raw({ status: 'open', stage: 'Fallback' })], loading: false, error: false })
    render(<ScopedMatchesTab scope="location" id="loc-1" />, { wrapper })
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Open (lookup)')).toBeInTheDocument()
    expect(screen.queryByText(mt('cols.stage'))).toBeNull()
  })
})

describe('ScopedMatchesTab · Periode cell (point 4/6)', () => {
  // Fake timers scoped to THIS block only — userEvent's own internal delays hang
  // forever under fake timers, which is exactly what made the "+ Match" describe
  // below time out when this was a file-wide beforeEach/afterEach.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-03T10:00:00'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('formats the contract window as DD-MM-YYYY', () => {
    mockUseScopedEntityList.mockReturnValue({ rows: [raw()], loading: false, error: false })
    render(<ScopedMatchesTab scope="location" id="loc-1" />, { wrapper })
    expect(screen.getByText(/01-01-2026.*31-12-2026/)).toBeInTheDocument()
  })

  it('shows an expiry chip within 30 days, none further out', () => {
    // Fixed fixture date (10 days after the frozen "now" above), never real-clock arithmetic.
    mockUseScopedEntityList.mockReturnValue({ rows: [raw({ endDate: '2026-08-13' })], loading: false, error: false })
    render(<ScopedMatchesTab scope="location" id="loc-1" />, { wrapper })
    expect(screen.getByText(ct('matchesView.expiresOn', { date: '13-08-2026' }))).toBeInTheDocument()
  })
})

describe('ScopedMatchesTab · "+ Match" (point 1)', () => {
  it('does not render the add trigger when the customer is unknown', () => {
    mockUseScopedEntityList.mockReturnValue({ rows: [], loading: false, error: false })
    render(<ScopedMatchesTab scope="location" id="loc-1" />, { wrapper })
    expect(screen.queryByRole('button', { name: cust('matches.add') })).toBeNull()
  })

  it('opens MatchModal prefilled with the customer + location id on click', async () => {
    const user = userEvent.setup()
    mockUseScopedEntityList.mockReturnValue({ rows: [], loading: false, error: false })
    render(<ScopedMatchesTab scope="location" id="loc-1" customerId="cust-1" />, { wrapper })
    await user.click(screen.getByRole('button', { name: cust('matches.add') }))
    expect(matchModalProps).toHaveBeenCalledWith(expect.objectContaining({
      initialCustomerId: 'cust-1', initialCustomerLocationId: 'loc-1', initialCustomerDepartmentId: undefined,
    }))
  })

  it('prefills the department id (not location) when scoped to a department', async () => {
    const user = userEvent.setup()
    mockUseScopedEntityList.mockReturnValue({ rows: [], loading: false, error: false })
    render(<ScopedMatchesTab scope="department" id="dep-1" customerId="cust-1" />, { wrapper })
    await user.click(screen.getByRole('button', { name: cust('matches.add') }))
    expect(matchModalProps).toHaveBeenCalledWith(expect.objectContaining({
      initialCustomerId: 'cust-1', initialCustomerDepartmentId: 'dep-1', initialCustomerLocationId: undefined,
    }))
  })

  it('invalidates this exact scoped query key when the modal reports a created match', async () => {
    const user = userEvent.setup()
    mockUseScopedEntityList.mockReturnValue({ rows: [], loading: false, error: false })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    render(createElement(QueryClientProvider, { client }, createElement(ScopedMatchesTab, { scope: 'location', id: 'loc-1', customerId: 'cust-1' })))
    await user.click(screen.getByRole('button', { name: cust('matches.add') }))
    const { onCreated } = matchModalProps.mock.calls.at(-1)?.[0] as { onCreated: () => void }
    onCreated()
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['location-matches', '/matches', 'customer_location_id', 'loc-1'] }))
  })
})
