/**
 * ScopedOpportunitiesTab — the scoped location/department/contact "Kansen"
 * sub-tab. Unlike ScopedMatchesTab/ScopedVacanciesTab's own test files, this one
 * does NOT stub out `useScopedEntityList` wholesale — the whole point of the
 * SCOPE PARAM tests below is to prove the REAL request (route + exact param key),
 * per §13's "assert the request, never only that a callback fired". `@/lib/api`
 * is mocked instead, one level lower, so useScopedEntityList runs for real.
 *
 * CONTACT SCOPE proof: the `contact_id[]` key literally reaches axios, which is
 * what turns a single scalar value into the one-element-array querystring
 * shape OpportunityQuery expects (see the component's own file-header doc).
 *
 * Real i18n is loaded (side-effect import): the column headers/add-button label
 * assertions below read the real customers.json nested `opportunities.*` keys
 * this component reuses from the customer-level OpportunitiesTab.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import i18n from '@/i18n'
import api from '@/lib/api'
import ScopedOpportunitiesTab from './ScopedOpportunitiesTab'

const cust = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate: vi.fn() }) }))

// STAGE FILTER: mutable per-test, mirrors ScopedMatchesTab's own mockMatchStatuses —
// each entry deliberately carries an `id` DIFFERENT from its `value` slug, so a test
// that still narrows correctly proves the component keys the filter on `.value`, not
// the raw lookup `.id` (see the component's own STAGE FILTER doc for why that matters).
let mockStages: Array<{ id?: string; value: string; label: string; color?: string }> = []
vi.mock('@/lib/useOpportunityStages', () => ({ useOpportunityStages: () => ({ stages: mockStages }) }))

// AddOpportunityModal has its own exhaustive test file — stubbed here so this file
// only proves the TRIGGER wires the right initial props/query invalidation.
const addOpportunityModalProps = vi.fn()
vi.mock('@/pages/opportunities/AddOpportunityModal', () => ({
  default: (props: Record<string, unknown>) => { addOpportunityModalProps(props); return <div data-testid="add-opportunity-modal" /> },
}))

// One level BELOW useScopedEntityList (unlike the sibling test files) so the real
// hook's request shape is what gets asserted, not a stand-in return value.
const apiGet = vi.mocked(api.get)
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [], total: 0 }),
}))

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

// A raw /opportunities row — the shape mapOpportunity (reused verbatim) expects.
const rawOpp = (over: Record<string, unknown> = {}) => ({
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  id: 'opp-1', title: 'Verpleegkundige inzet', stage: { value: 'qualified', label: 'Gekwalificeerd', color: '#6FA8C4' },
  value: 1500, ...over,
})

afterEach(() => {
  vi.mocked(api.get).mockReset()
  addOpportunityModalProps.mockClear()
  mockStages = []
})

describe('ScopedOpportunitiesTab · scoped fetch (GET /opportunities)', () => {
  it('sends customer_department_id for scope="department"', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    render(<ScopedOpportunitiesTab scope="department" id="dep-1" />, { wrapper })
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/opportunities',
      expect.objectContaining({ params: { customer_department_id: 'dep-1', per_page: 100 } })))
  })

  it('sends customer_location_id for scope="location"', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    render(<ScopedOpportunitiesTab scope="location" id="loc-1" />, { wrapper })
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/opportunities',
      expect.objectContaining({ params: { customer_location_id: 'loc-1', per_page: 100 } })))
  })

  it('sends the ARRAY param contact_id[] for scope="contact"', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    render(<ScopedOpportunitiesTab scope="contact" id="contact-1" />, { wrapper })
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/opportunities',
      expect.objectContaining({ params: { 'contact_id[]': 'contact-1', per_page: 100 } })))
  })
})

describe('ScopedOpportunitiesTab · columns (title/stage/value)', () => {
  it('renders the title, its stage in colour, and the formatted value — three columns only', async () => {
    apiGet.mockResolvedValue({ data: { data: [rawOpp()] } })
    render(<ScopedOpportunitiesTab scope="location" id="loc-1" />, { wrapper })
    expect(await screen.findByText('Verpleegkundige inzet')).toBeInTheDocument()
    expect(screen.getByText('Gekwalificeerd')).toBeInTheDocument()
    expect(screen.getByText(/^€\s1\.500$/)).toBeInTheDocument()
    // No fourth column (e.g. expected close) — mirrors ScopedVacanciesTab/
    // ScopedMatchesTab staying at three columns in a narrow drawer panel.
    expect(screen.queryByText(cust('opportunities.col.expectedClose'))).toBeNull()
  })
})

describe('ScopedOpportunitiesTab · "+ Kans" (customer-only prefill)', () => {
  it('does not render the add trigger when the customer is unknown', async () => {
    apiGet.mockResolvedValue({ data: { data: [] } })
    render(<ScopedOpportunitiesTab scope="location" id="loc-1" />, { wrapper })
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: cust('opportunities.newOpportunity') })).toBeNull()
  })

  it('opens AddOpportunityModal prefilled with the customer id + name and this location (OPP-MODAL-PREFILL-1)', async () => {
    const user = userEvent.setup()
    apiGet.mockResolvedValue({ data: { data: [] } })
    render(<ScopedOpportunitiesTab scope="location" id="loc-1" customerId="cust-1" customerName="Zorggroep A" />, { wrapper })
    await user.click(screen.getByRole('button', { name: cust('opportunities.newOpportunity') }))
    expect(addOpportunityModalProps).toHaveBeenCalledWith(expect.objectContaining({
      defaultCustomerId: 'cust-1', customers: [{ id: 'cust-1', name: 'Zorggroep A' }],
      initialLocationId: 'loc-1', initialDepartmentId: undefined, initialContactId: undefined,
    }))
  })

  it('falls back to a blank customer-option label when customerName is not threaded (contact scope today)', async () => {
    const user = userEvent.setup()
    apiGet.mockResolvedValue({ data: { data: [] } })
    render(<ScopedOpportunitiesTab scope="contact" id="contact-1" customerId="cust-1" />, { wrapper })
    await user.click(screen.getByRole('button', { name: cust('opportunities.newOpportunity') }))
    expect(addOpportunityModalProps).toHaveBeenCalledWith(expect.objectContaining({
      defaultCustomerId: 'cust-1', customers: [{ id: 'cust-1', name: '' }],
      initialContactId: 'contact-1', initialLocationId: undefined, initialDepartmentId: undefined,
    }))
  })

  it('pre-sets the department id (not location/contact) when scoped to a department', async () => {
    const user = userEvent.setup()
    apiGet.mockResolvedValue({ data: { data: [] } })
    render(<ScopedOpportunitiesTab scope="department" id="dep-1" customerId="cust-1" customerName="Zorggroep A" />, { wrapper })
    await user.click(screen.getByRole('button', { name: cust('opportunities.newOpportunity') }))
    expect(addOpportunityModalProps).toHaveBeenCalledWith(expect.objectContaining({
      initialDepartmentId: 'dep-1', initialLocationId: undefined, initialContactId: undefined,
    }))
  })

  it('invalidates this exact scoped query key when the modal reports a created opportunity', async () => {
    const user = userEvent.setup()
    apiGet.mockResolvedValue({ data: { data: [] } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    render(createElement(QueryClientProvider, { client }, createElement(ScopedOpportunitiesTab, { scope: 'department', id: 'dep-1', customerId: 'cust-1' })))
    await user.click(screen.getByRole('button', { name: cust('opportunities.newOpportunity') }))
    const { onCreated } = addOpportunityModalProps.mock.calls.at(-1)?.[0] as { onCreated: () => void }
    onCreated()
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['department-opportunities', '/opportunities', 'customer_department_id', 'dep-1'] }))
  })
})

describe('ScopedOpportunitiesTab · stage filter keys on value, not the lookup id', () => {
  it('narrows to the row whose stageValue matches the default-guess "open" stage, even though the lookup id differs from it', async () => {
    // Each stage's `id` is deliberately NOT its `value` — if the component handed
    // the raw stage list straight to ScopedListTab, the shared default-guess would
    // key on `id` and never match either row's `stageValue`, so BOTH rows would
    // still show. Only one showing proves the id-strip (file header) is working.
    /* eslint-disable no-restricted-syntax -- test fixture hex, not a UI colour */
    mockStages = [
      { id: 'stage-uuid-open', value: 'open', label: 'Open', color: '#111111' },
      { id: 'stage-uuid-qual', value: 'qualified', label: 'Gekwalificeerd', color: '#222222' },
    ]
    apiGet.mockResolvedValue({ data: { data: [
      rawOpp({ id: 'opp-open', title: 'Open kans', stage: { value: 'open', label: 'Open', color: '#111111' } }),
      rawOpp({ id: 'opp-qual', title: 'Gekwalificeerde kans', stage: { value: 'qualified', label: 'Gekwalificeerd', color: '#222222' } }),
    ] } })
    /* eslint-enable no-restricted-syntax */
    render(<ScopedOpportunitiesTab scope="location" id="loc-1" />, { wrapper })
    expect(await screen.findByText('Open kans')).toBeInTheDocument()
    expect(screen.queryByText('Gekwalificeerde kans')).toBeNull()
  })

  it('renders no filter pill when the stage lookup is empty (today\'s toolbar unchanged)', async () => {
    apiGet.mockResolvedValue({ data: { data: [rawOpp()] } })
    render(<ScopedOpportunitiesTab scope="location" id="loc-1" />, { wrapper })
    await screen.findByText('Verpleegkundige inzet')
    expect(screen.queryByRole('button', { name: cust('filters.allStatuses') })).toBeNull()
  })
})
