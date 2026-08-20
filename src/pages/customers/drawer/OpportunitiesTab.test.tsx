/**
 * OpportunitiesTab · "+ Nieuwe kans" trigger (Danny 27-07: "+ Nieuwe kans moet
 * een knopje zijn zoals ook bij de kandidaat drill down!!") — covers only the
 * house-button swap: the bare text+Plus link is now the shared DrawerAddButton,
 * same onClick (opens AddOpportunityModal, prefilled with this customer). The
 * modal itself is a different file's scope (its own lookup/cascade hooks) —
 * stood in with a marker, mirroring WorkTab.test.tsx's MatchModal stub.
 *
 * STAGE-FILTER-1 (this task, Danny: "bij Kansen mis ik ook nog de statussen"):
 * two more describe blocks below cover the stage filter (shared StatusFilterSelect/
 * useStatusFilter, mirrors DepartmentsPanel) and the `customer_opportunity_table_
 * color_stage` colour-on/off toggle for the stage chip.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OpportunitiesTab from './OpportunitiesTab'
import api from '@/lib/api'
import { invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import type { ApiOpportunity } from '@/types/opportunity'
import { chipInk } from '@/lib/tint'

// A controllable stand-in for the customer's opportunities so each test can hand it
// a different fixture (mirrors EntityTasksTab.test.tsx's `mockTasks` pattern) — the
// pre-existing "+ Nieuwe kans" tests below need an empty list, the new stage-filter
// tests need real rows with different stages.
const { useCustomerOpportunitiesMock } = vi.hoisted(() => ({ useCustomerOpportunitiesMock: vi.fn() }))
const mockOpportunities = (rows: ApiOpportunity[]) =>
  useCustomerOpportunitiesMock.mockReturnValue({ rows, loading: false, error: false, reload: vi.fn() })

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasModule: () => false }) }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn() }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `d(${v})` }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))
vi.mock('../hooks/useCustomerDrawerData', () => ({
  useCustomerOpportunities: () => useCustomerOpportunitiesMock(),
  useCustomerOpenShifts: () => ({ rows: [], loading: false, error: false, planningConfigured: true, planningReason: undefined }),
}))
// The customer drawer's own tenant-settings blob — only the colour toggle below
// needs to control it; every other test relies on the default (colour ON, fallback true).
// getActiveTenantId is the real (unmocked) useAllSettings module's tenant-scope key —
// this file relies on it via `invalidateAllSettingsCache` above.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: {} })), delete: vi.fn(() => Promise.resolve({})) },
  getActiveTenantId: vi.fn(() => null),
}))
/* eslint-disable no-restricted-syntax -- fixture DATA mirroring the seed stage colours, not UI styling */
vi.mock('@/lib/useOpportunityStages', () => ({
  useOpportunityStages: () => ({ stages: [
    { id: 'stage-1', value: 'lead', label: 'Lead', color: '#94A3B8' },
    { id: 'stage-2', value: 'won', label: 'Gewonnen', color: '#79B58E' },
  ] }),
}))
/* eslint-enable no-restricted-syntax */
// AddOpportunityModal is a different file's scope (lookup/cascade hooks) — a
// marker exposing `defaultCustomerId` proves the "+" trigger's dialog-opens
// wiring without mounting the real form.
vi.mock('@/pages/opportunities/AddOpportunityModal', () => ({
  default: ({ defaultCustomerId }: { defaultCustomerId?: string | number }) => (
    <div data-testid="add-opportunity-modal" data-default-customer-id={defaultCustomerId ?? ''} />
  ),
}))

// `useAllSettings` keeps a module-level cache shared across tests in this file —
// reset it too (mirrors LocationsTab.test.tsx), otherwise the second colour-toggle
// test below would silently reuse the FIRST test's already-resolved settings blob.
beforeEach(() => { vi.clearAllMocks(); mockOpportunities([]); invalidateAllSettingsCache() })

describe('OpportunitiesTab · "+ Nieuwe kans" trigger (Danny 27-07: house button, not a bare text link)', () => {
  it('does not render the modal until the trigger is clicked', () => {
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    expect(screen.queryByTestId('add-opportunity-modal')).not.toBeInTheDocument()
  })

  it('opens AddOpportunityModal, prefilled with this customer, when the house button is clicked', async () => {
    const user = userEvent.setup()
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    await user.click(screen.getByRole('button', { name: 'opportunities.newOpportunity' }))
    expect(screen.getByTestId('add-opportunity-modal')).toHaveAttribute('data-default-customer-id', 'cust-1')
  })
})

describe('OpportunitiesTab · stage filter narrows the rows (Danny: "bij Kansen mis ik ook nog de statussen")', () => {
  const rows: ApiOpportunity[] = [
    // eslint-disable-next-line no-restricted-syntax -- DATA: test-seed colour, not a UI colour choice
    { id: 'opp-lead', title: 'Nieuwe zorgvraag', stage: { value: 'lead', label: 'Lead', color: '#94A3B8' } },
    // eslint-disable-next-line no-restricted-syntax -- DATA: test-seed colour, not a UI colour choice
    { id: 'opp-won', title: 'Contract getekend', stage: { value: 'won', label: 'Gewonnen', color: '#79B58E' } },
  ]

  it('shows every opportunity until a stage is picked (nothing selected = all)', () => {
    mockOpportunities(rows)
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    expect(screen.getByText('Nieuwe zorgvraag')).toBeInTheDocument()
    expect(screen.getByText('Contract getekend')).toBeInTheDocument()
  })

  it('narrows the table to the picked stage only', async () => {
    const user = userEvent.setup()
    mockOpportunities(rows)
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    // i18n is unmocked here, so t() echoes the raw key.
    await user.click(screen.getByRole('button', { name: 'filters.status' }))
    // The dropdown OPTION is a <button>; the table's own stage chip for "Gewonnen"
    // is a <span> (SoftChip) — querying by button role picks the option, never the chip.
    await user.click(await screen.findByRole('button', { name: 'Gewonnen' }))
    expect(screen.getByText('Contract getekend')).toBeInTheDocument()
    expect(screen.queryByText('Nieuwe zorgvraag')).toBeNull()
  })
})

/** Search bar (Danny 03-08: "bij Kansen-tabblad op hoofd-drilldown mis ik ook
 *  zoekbalk") — narrows on the opportunity title, on top of the stage filter. */
describe('OpportunitiesTab · search narrows the rows', () => {
  const rows: ApiOpportunity[] = [
    // eslint-disable-next-line no-restricted-syntax -- DATA: test-seed colour, not a UI colour choice
    { id: 'opp-a', title: 'Nieuwe zorgvraag Amsterdam', stage: { value: 'lead', label: 'Lead', color: '#94A3B8' } },
    // eslint-disable-next-line no-restricted-syntax -- DATA: test-seed colour, not a UI colour choice
    { id: 'opp-b', title: 'Contract getekend Utrecht', stage: { value: 'won', label: 'Gewonnen', color: '#79B58E' } },
  ]

  it('shows every opportunity until something is typed', () => {
    mockOpportunities(rows)
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    expect(screen.getByText('Nieuwe zorgvraag Amsterdam')).toBeInTheDocument()
    expect(screen.getByText('Contract getekend Utrecht')).toBeInTheDocument()
  })

  it('narrows to the matching title only', async () => {
    const user = userEvent.setup()
    mockOpportunities(rows)
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    await user.type(screen.getByPlaceholderText('opportunities.searchPlaceholder'), 'utrecht')
    expect(screen.getByText('Contract getekend Utrecht')).toBeInTheDocument()
    expect(screen.queryByText('Nieuwe zorgvraag Amsterdam')).toBeNull()
  })
})

describe('OpportunitiesTab · stage colour toggle (customer_opportunity_table_color_stage)', () => {
  const oneRow: ApiOpportunity[] = [
    // eslint-disable-next-line no-restricted-syntax -- DATA: test-seed colour, not a UI colour choice
    { id: 'opp-lead', title: 'Nieuwe zorgvraag', stage: { value: 'lead', label: 'Lead', color: '#94A3B8' } },
  ]

  it('colours the stage chip by default (today\'s behaviour)', async () => {
    mockOpportunities(oneRow)
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    // eslint-disable-next-line no-restricted-syntax -- DATA: asserts the fixture's own stage colour, not a UI choice
    await waitFor(() => expect(screen.getByText('Lead')).toHaveStyle({ color: chipInk('#94a3b8') }))
  })

  it('renders the stage chip as plain text once the tenant setting is off', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_opportunity_table_color_stage: 'false' } })
        : Promise.resolve({ data: {} }))
    mockOpportunities(oneRow)
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    await waitFor(() => expect(screen.getByText('Lead')).toHaveStyle({ color: 'var(--text)' }))
  })
})

/**
 * K10c (PLAN-KLANTEN batch 1): the tenant's "Kansen in uren" setting
 * (`opportunity_value_in_hours`) must switch this tab's value column between
 * euro and hours exactly like OpportunitiesTable already does — the drawer
 * tab was ignoring it and always showing euro.
 */
describe('OpportunitiesTab · value column follows opportunity_value_in_hours (K10c)', () => {
  const rowWithBoth: ApiOpportunity[] = [
    // eslint-disable-next-line no-restricted-syntax -- DATA: test-seed colour, not a UI colour choice
    { id: 'opp-value', title: 'Nieuwe zorgvraag', stage: { value: 'lead', label: 'Lead', color: '#94A3B8' }, value: 1234, hours: 40 } as ApiOpportunity,
  ]

  it('shows the euro amount when the setting is off (default)', async () => {
    mockOpportunities(rowWithBoth)
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    expect(await screen.findByText('€ 1.234')).toBeInTheDocument()
    expect(screen.queryByText('opportunities:cols.hoursValue')).not.toBeInTheDocument()
  })

  it('shows hours (via the shared cols.hoursValue key) when the setting is on', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { opportunity_value_in_hours: 'true' } })
        : Promise.resolve({ data: {} }))
    mockOpportunities(rowWithBoth)
    render(<OpportunitiesTab customerId="cust-1" customerName="Acme" />)
    // i18n is unmocked here, so t() echoes the raw explicit-namespace key with its
    // interpolated count — proves the SAME shared key OpportunitiesTable uses, not a local copy.
    expect(await screen.findByText('opportunities:cols.hoursValue')).toBeInTheDocument()
    expect(screen.queryByText('€ 1.234')).not.toBeInTheDocument()
  })
})
