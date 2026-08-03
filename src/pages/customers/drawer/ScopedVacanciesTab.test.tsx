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
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import i18n from '@/i18n'
import ScopedVacanciesTab from './ScopedVacanciesTab'

const cust = (key: string) => i18n.t(key, { ns: 'customers' })

vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate: vi.fn() }) }))
vi.mock('@/context/VacancyLookupsContext', () => ({ VacancyLookupsProvider: ({ children }: { children: ReactNode }) => children }))

const mockUseScopedEntityList = vi.fn()
vi.mock('../hooks/useScopedEntityList', () => ({ useScopedEntityList: () => mockUseScopedEntityList() }))

const addVacancyModalProps = vi.fn()
vi.mock('@/pages/vacancies/AddVacancyModal', () => ({
  default: (props: Record<string, unknown>) => { addVacancyModalProps(props); return <div data-testid="add-vacancy-modal" /> },
}))

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

afterEach(() => { addVacancyModalProps.mockClear() })

describe('ScopedVacanciesTab · "+ Vacature" (point 1)', () => {
  it('does not render the add trigger when the customer is unknown', () => {
    mockUseScopedEntityList.mockReturnValue({ rows: [], loading: false, error: false })
    render(<ScopedVacanciesTab scope="location" id="loc-1" />, { wrapper })
    expect(screen.queryByRole('button', { name: cust('vacancies.add') })).toBeNull()
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
    await user.click(screen.getByRole('button', { name: cust('vacancies.add') }))
    const { onCreated } = addVacancyModalProps.mock.calls.at(-1)?.[0] as { onCreated: () => void }
    onCreated()
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['location-vacancies', '/vacancies', 'customer_location_id', 'loc-1'] }))
  })
})
