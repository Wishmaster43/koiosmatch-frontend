/**
 * ScopedVacanciesTab — Danny's point 1 (the scoped location/department
 * Vacatures sub-tab gains a "+ Vacature" trigger). AddVacancyModal and
 * VacancyLookupsProvider are stubbed — this file only proves the TRIGGER wires
 * the customer LOCK + the location/department id/name into the modal and
 * invalidates the right scoped query key on create, not the modal's own
 * internals (covered by AddVacancyModal.test.tsx).
 *
 * Real i18n is loaded here (side-effect import): the app-wide i18n bundle
 * initialises as soon as ANYTHING in this component's import graph touches
 * `@/lib/datetime` (its locale map lives in `@/i18n`) — a raw-key stub would
 * assert against text that never actually renders.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import i18n from '@/i18n'
import api from '@/lib/api'
import ScopedVacanciesTab from './ScopedVacanciesTab'

const cust = (key: string) => i18n.t(key, { ns: 'customers' })

// K7c/K7b: a shared spy (vi.hoisted so it exists before the vi.mock factory below
// runs) so the deep-link tests can assert what openEntity was called with.
const { openEntitySpy } = vi.hoisted(() => ({ openEntitySpy: vi.fn() }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: openEntitySpy, navigate: vi.fn() }) }))
vi.mock('@/context/VacancyLookupsContext', () => ({ VacancyLookupsProvider: ({ children }: { children: ReactNode }) => children }))
// K7b: the row pencil is permission-gated on vacancies.update.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: (p: string) => p === 'vacancies.update' }) }))

const mockUseScopedEntityList = vi.fn()
vi.mock('../hooks/useScopedEntityList', () => ({ useScopedEntityList: () => mockUseScopedEntityList() }))

const addVacancyModalProps = vi.fn()
vi.mock('@/pages/vacancies/AddVacancyModal', () => ({
  default: (props: Record<string, unknown>) => { addVacancyModalProps(props); return <div data-testid="add-vacancy-modal" /> },
}))

// STATUS FILTER (Danny 05-08): this tab now fetches GET /vacancy-statuses directly,
// same as the customer-level VacanciesTab (mirrors that file's own mock/fixture —
// the 'open' id deliberately ALSO matches the guess-heuristic's slug list).
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [], total: 0 }),
  // The real (unmocked) useAllSettings module reads this to tenant-scope its cache —
  // ScopedVacanciesTab mounts it transitively (status filter defaults).
  getActiveTenantId: vi.fn(() => null),
}))
const VACANCY_STATUSES = [
  { id: 'open', name: 'Open', active: true },
  { id: 'closed', name: 'Gesloten', active: true },
]

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

afterEach(() => { addVacancyModalProps.mockClear(); openEntitySpy.mockClear() })

// Every test gets a sane default: the /vacancy-statuses lookup resolves with both
// seed statuses unless a specific test overrides it (mirrors VacanciesTab.test.tsx).
beforeEach(() => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/vacancy-statuses') return Promise.resolve({ data: { data: VACANCY_STATUSES } })
    return Promise.resolve({ data: { data: [] } })
  })
})

describe('ScopedVacanciesTab · "+ Vacature" (point 1)', () => {
  it('does not render the add trigger when the customer is unknown', async () => {
    mockUseScopedEntityList.mockReturnValue({ rows: [], loading: false, error: false })
    render(<ScopedVacanciesTab scope="location" id="loc-1" />, { wrapper })
    expect(screen.queryByRole('button', { name: cust('vacancies.add') })).toBeNull()
    // Flush the /vacancy-statuses fetch this component now fires on mount — waits for
    // the status filter itself to mount (only happens once `resolved` flips true), so
    // its state update never lands after the test body (unwrapped act() warning).
    await screen.findByRole('button', { name: cust('filters.allStatuses') })
  })

  it('locks the customer and pre-sets the location id/name on click', async () => {
    const user = userEvent.setup()
    mockUseScopedEntityList.mockReturnValue({ rows: [], loading: false, error: false })
    render(
      <ScopedVacanciesTab scope="location" id="loc-1" customerId="cust-1" customerName="Zorggroep A" scopeName="Locatie Noord" />,
      { wrapper },
    )
    await user.click(screen.getByRole('button', { name: cust('vacancies.add') }))
    expect(screen.getByTestId('add-vacancy-modal')).toBeInTheDocument()
    expect(addVacancyModalProps).toHaveBeenCalledWith(expect.objectContaining({
      lockCustomerId: 'cust-1', lockCustomerName: 'Zorggroep A',
      initialCustomerLocationId: 'loc-1', initialCustomerLocationName: 'Locatie Noord',
      initialCustomerDepartmentId: undefined, initialCustomerDepartmentName: undefined,
    }))
  })

  it('pre-sets the department id/name (not location) when scoped to a department', async () => {
    const user = userEvent.setup()
    mockUseScopedEntityList.mockReturnValue({ rows: [], loading: false, error: false })
    render(
      <ScopedVacanciesTab scope="department" id="dep-1" customerId="cust-1" customerName="Zorggroep A" scopeName="Dagbesteding" />,
      { wrapper },
    )
    await user.click(screen.getByRole('button', { name: cust('vacancies.add') }))
    expect(addVacancyModalProps).toHaveBeenCalledWith(expect.objectContaining({
      initialCustomerDepartmentId: 'dep-1', initialCustomerDepartmentName: 'Dagbesteding',
      initialCustomerLocationId: undefined, initialCustomerLocationName: undefined,
    }))
  })

  it('invalidates this exact scoped query key when the modal reports a created vacancy', async () => {
    const user = userEvent.setup()
    mockUseScopedEntityList.mockReturnValue({ rows: [], loading: false, error: false })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    render(createElement(QueryClientProvider, { client }, createElement(ScopedVacanciesTab, { scope: 'location', id: 'loc-1', customerId: 'cust-1' })))
    // Flush the /vacancy-statuses fetch this component fires on mount first (waits
    // for the status filter to actually mount), so its resolution never lands after
    // this test body (unwrapped act() warning).
    await screen.findByRole('button', { name: cust('filters.allStatuses') })
    await user.click(screen.getByRole('button', { name: cust('vacancies.add') }))
    const { onCreated } = addVacancyModalProps.mock.calls.at(-1)?.[0] as { onCreated: () => void }
    // Wrapped in act(): a plain call (unlike a user-event interaction) is the
    // classic unwrapped-state-update trigger React warns about.
    act(() => { onCreated() })
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['location-vacancies', '/vacancies', 'customer_location_id', 'loc-1'] }))
  })
})

describe('ScopedVacanciesTab · status filter (Danny 05-08 "ik mis de status naast het zoekveld?")', () => {
  it('narrows rows once the real /vacancy-statuses lookup resolves (same active-only guess as VacanciesTab)', async () => {
    mockUseScopedEntityList.mockReturnValue({
      rows: [
        { id: 'v-open', title: 'Openstaande vacature', status: { value: 'open', label: 'Open' }, applications: 0 },
        { id: 'v-closed', title: 'Gesloten vacature', status: { value: 'closed', label: 'Gesloten' }, applications: 0 },
      ], loading: false, error: false,
    })
    render(<ScopedVacanciesTab scope="location" id="loc-1" customerId="cust-1" />, { wrapper })
    // Both checks in ONE waitFor: the lookup resolves a tick after mount, so an
    // earlier unfiltered render transiently shows both rows (mirrors VacanciesTab.test.tsx).
    await waitFor(() => {
      expect(screen.getByText('Openstaande vacature')).toBeInTheDocument()
      expect(screen.queryByText('Gesloten vacature')).toBeNull()
    })
  })
})

describe('ScopedVacanciesTab · K7c applications deep link + K7b edit pencil', () => {
  beforeEach(() => {
    mockUseScopedEntityList.mockReturnValue({
      rows: [{ id: 'v-open', title: 'Openstaande vacature', status: { value: 'open', label: 'Open' }, applications: 3 }],
      loading: false, error: false,
    })
  })

  it('the applications count is a ghost button that deep-links to the applicants tab', async () => {
    const user = userEvent.setup()
    render(<ScopedVacanciesTab scope="location" id="loc-1" customerId="cust-1" />, { wrapper })
    await screen.findByText('Openstaande vacature')

    await user.click(screen.getByLabelText(cust('vacancies.col.applicationsOpen')))
    expect(openEntitySpy).toHaveBeenCalledWith('vacancies', 'v-open', 'applicants')
  })

  it('a row pencil opens that vacancy\'s own drawer for editing', async () => {
    const user = userEvent.setup()
    render(<ScopedVacanciesTab scope="location" id="loc-1" customerId="cust-1" />, { wrapper })
    await screen.findByText('Openstaande vacature')

    await user.click(screen.getByLabelText(cust('vacancies.editVacancy')))
    expect(openEntitySpy).toHaveBeenCalledWith('vacancies', 'v-open')
  })
})
