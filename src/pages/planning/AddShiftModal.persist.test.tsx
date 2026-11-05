/** AddShiftModal · persist (split from AddShiftModal.test.tsx; the real save request and its gates). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import AddShiftModal from './AddShiftModal'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG', 'Helpende'], functionOptions: ['Verzorgende IG', 'Helpende'].map(n => ({ value: n, label: n })), allowFreeEntry: false }) }))
// `@/lib/datetime` transitively imports the real i18n bootstrap (module-scope
// side effect) — mocked here so the react-i18next stub above stays effective,
// mirroring PlanningPage.test.tsx / ShiftStaffingDrawer.test.tsx.
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ locale: 'nl-NL' }) }))

// The create mutation is mocked here (request-level coverage lives in
// ./hooks/usePlanningShifts.test.tsx) so this file stays about the modal's
// own rendering/gating behaviour.
const mockMutateAsync = vi.fn().mockResolvedValue({ id: 's1' })
vi.mock('./hooks/usePlanningShifts', () => ({
  useCreatePlanningShift: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}))

// D8 fix regression: the picked candidate now assigns right after create,
// through the shared useAssignShiftCandidate hook (./hooks/useShiftStaffing)
// — the same one ShiftStaffingDrawer's own assign mutation delegates to
// (verifier fixronde: no more inline api.post). Mocked here so this file
// stays about the modal's own request-building behaviour (the route itself
// is covered in ./hooks/useShiftStaffing.test.tsx).
const mockAssignMutateAsync = vi.fn().mockResolvedValue({ id: 'sched1' })
vi.mock('./hooks/useShiftStaffing', () => ({
  useAssignShiftCandidate: () => ({ mutateAsync: mockAssignMutateAsync, isPending: false }),
}))

// A QueryClientProvider is required by usePlanningShifts' useMutation — every
// render in this file goes through it.
function renderModal(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const mockCustomers   = vi.fn()
const mockDepartments = vi.fn()
const mockCandidates  = vi.fn()
vi.mock('./hooks/useShiftLookups', () => ({
  useShiftCustomers:       () => mockCustomers(),
  useShiftDepartments:     (id: string) => mockDepartments(id),
  useShiftCandidateSearch: (q: string) => mockCandidates(q),
}))

// PLANNING-ORDER-CREATE-1: the modal now also reads the real order list for its
// order picker — mocked here so this file stays focused on the modal's own
// behaviour, same reasoning as the other lookup mocks above.
const mockOrders = vi.fn()
vi.mock('./hooks/usePlanningOrders', () => ({
  usePlanningOrdersList: () => mockOrders(),
}))

const noop = () => {}

beforeEach(() => {
  vi.clearAllMocks()
  mockCustomers.mockReturnValue({ customers: [{ id: 'c1', name: 'Rivas Zorggroep' }, { id: 'c2', name: 'Yesway Zorg' }], loading: false, error: false })
  mockDepartments.mockReturnValue({ departments: [], loading: false, error: false })
  mockCandidates.mockReturnValue({ candidates: [], loading: false, error: false })
  mockOrders.mockReturnValue({ orders: [], loading: false, error: false })
})

describe('AddShiftModal · persist (PLANNING-PERSIST-1-staart)', () => {
  it('disables Save with an honest tooltip while no order is picked', () => {
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    const saveButton = screen.getByText('common:save').closest('button')
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveAttribute('title', 'pickOrderFirst')
  })

  it('POSTs the shift (incl. notes) and calls onAdd + onClose once an order is picked', async () => {
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'ICU dayshift', status: 'open', shifts_count: 0 }], loading: false, error: false })
    const onAdd = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date('2026-07-20')} onClose={onClose} onAdd={onAdd} />)

    await user.click(screen.getByRole('button', { name: 'order.listTitle' }))
    await user.click(screen.getByRole('button', { name: 'ICU dayshift' }))
    const saveButton = screen.getByText('common:save').closest('button') as HTMLButtonElement
    expect(saveButton).not.toBeDisabled()
    await user.type(screen.getByLabelText('notePlaceholder'), 'Bring own PPE')
    await user.click(saveButton)

    expect(mockMutateAsync).toHaveBeenCalledWith({
      planning_order_id: 'o1',
      customer_department_id: null,
      function: null,
      start_time: '2026-07-20T07:00:00',
      end_time: '2026-07-20T15:00:00',
      number_persons: 1,
      notes: 'Bring own PPE',
    })
    expect(onAdd).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  // PLANNING-PERSIST-1-staart fixronde: Number('') is 0, not NaN, so a numeric
  // state var would silently accept a cleared field as a fake valid count —
  // personCount is a raw string precisely so this stays gated.
  it('disables Save while the number-of-people field is cleared, even with an order picked', async () => {
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'ICU dayshift', status: 'open', shifts_count: 0 }], loading: false, error: false })
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)

    await user.click(screen.getByRole('button', { name: 'order.listTitle' }))
    await user.click(screen.getByRole('button', { name: 'ICU dayshift' }))
    const saveButton = screen.getByText('common:save').closest('button') as HTMLButtonElement
    expect(saveButton).not.toBeDisabled()

    await user.clear(screen.getByLabelText('fPersons'))
    expect(saveButton).toBeDisabled()
  })

  // §3: the save-failure notice must be announced to assistive tech, not just shown visually.
  it('shows the save-failure notice as an alert (role="alert") when the mutation rejects', async () => {
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'ICU dayshift', status: 'open', shifts_count: 0 }], loading: false, error: false })
    mockMutateAsync.mockRejectedValueOnce(new Error('network down'))
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)

    await user.click(screen.getByRole('button', { name: 'order.listTitle' }))
    await user.click(screen.getByRole('button', { name: 'ICU dayshift' }))
    await user.click(screen.getByText('common:save').closest('button') as HTMLButtonElement)

    expect(await screen.findByRole('alert')).toHaveTextContent('common:errorGeneric')
  })
})
