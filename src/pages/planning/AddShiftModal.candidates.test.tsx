/** AddShiftModal · candidates (split from AddShiftModal.test.tsx; candidate search and the notes field). */
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

// The trigger's accessible name is now the static field label (native <label
// for> association — CreatableSelect's button gained an `id` matching the
// local Field's `htmlFor`), not the shared "common:select" placeholder text
// it used to expose — so each trigger is found by its own stable label key.
const customerTrigger = () => screen.getByRole('button', { name: 'fCustomer' })

describe('AddShiftModal · candidate search (SUGGESTIES mock removed)', () => {
  it('loading: shows the loading state', () => {
    mockCandidates.mockReturnValue({ candidates: [], loading: true, error: false })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('error: shows the generic error state', () => {
    mockCandidates.mockReturnValue({ candidates: [], loading: false, error: true })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('common:errorGeneric')).toBeInTheDocument()
  })

  it('empty: shows the no-results state (never a fabricated favourite/suggestion list)', () => {
    // The order picker also renders 'common:noResults' by default (no seeded
    // orders in this file's mocks) — seed one order here so this assertion
    // stays scoped to the candidate panel, not ambiguous across both pickers.
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'Seeded order' }], loading: false, error: false })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('common:noResults')).toBeInTheDocument()
  })

  it('success: renders real candidate rows with no fabricated favourite/distance/hours data', () => {
    mockCandidates.mockReturnValue({ candidates: [{ id: 'k1', name: 'Ismail Eddahchouri', functionTitle: 'IG-Verzorging' }], loading: false, error: false })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('Ismail Eddahchouri')).toBeInTheDocument()
    expect(screen.getByText('IG-Verzorging')).toBeInTheDocument()
    expect(screen.queryByText(/km/)).not.toBeInTheDocument()
    expect(screen.queryByText('favorites')).not.toBeInTheDocument()
    expect(screen.queryByText('suggestions')).not.toBeInTheDocument()
  })

  it('selecting a candidate fills the scheduled-worker card (Save stays gated with no order picked)', async () => {
    mockCandidates.mockReturnValue({ candidates: [{ id: 'k1', name: 'Ismail Eddahchouri', functionTitle: 'IG-Verzorging' }], loading: false, error: false })
    const onAdd = vi.fn()
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date('2026-07-20')} onClose={noop} onAdd={onAdd} />)

    await user.click(customerTrigger())
    await user.click(screen.getByRole('button', { name: 'Rivas Zorggroep' }))
    await user.click(screen.getByText('Ismail Eddahchouri'))
    // No order was picked (PLANNING-PERSIST-1-staart's one required field) — Save
    // stays disabled and clicking it is a no-op.
    await user.click(screen.getByText('common:save'))

    expect(onAdd).not.toHaveBeenCalled()
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  // D8 fix: the picked candidate used to be a dead end (no request anywhere) —
  // Save now POSTs the real assignment right after the shift is created.
  it('POSTs a real assignment for the picked candidate once an order is picked and Save is clicked', async () => {
    mockCandidates.mockReturnValue({ candidates: [{ id: 'k1', name: 'Ismail Eddahchouri', functionTitle: 'IG-Verzorging' }], loading: false, error: false })
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'ICU dayshift', status: 'open', shifts_count: 0 }], loading: false, error: false })
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date('2026-07-20')} onClose={noop} onAdd={noop} />)

    await user.click(screen.getByRole('button', { name: 'order.listTitle' }))
    await user.click(screen.getByRole('button', { name: 'ICU dayshift' }))
    await user.click(screen.getByText('Ismail Eddahchouri'))
    await user.click(screen.getByText('common:save').closest('button') as HTMLButtonElement)

    expect(mockMutateAsync).toHaveBeenCalled()
    expect(mockAssignMutateAsync).toHaveBeenCalledWith({ shiftId: 's1', candidateId: 'k1' })
  })

  // Verifier fixronde: create-succeeds-but-assignment-fails must never re-POST
  // /planning/shifts on retry — the modal remembers the created shift's id and
  // only re-runs the assignment.
  it('retries only the assignment (never re-creates the shift) after create succeeds but assignment fails', async () => {
    mockCandidates.mockReturnValue({ candidates: [{ id: 'k1', name: 'Ismail Eddahchouri', functionTitle: 'IG-Verzorging' }], loading: false, error: false })
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'ICU dayshift', status: 'open', shifts_count: 0 }], loading: false, error: false })
    mockAssignMutateAsync.mockRejectedValueOnce(new Error('assignment failed'))
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date('2026-07-20')} onClose={noop} onAdd={noop} />)

    await user.click(screen.getByRole('button', { name: 'order.listTitle' }))
    await user.click(screen.getByRole('button', { name: 'ICU dayshift' }))
    await user.click(screen.getByText('Ismail Eddahchouri'))
    const saveButton = screen.getByText('common:save').closest('button') as HTMLButtonElement
    await user.click(saveButton)
    expect(await screen.findByRole('alert')).toHaveTextContent('staffing.assignError')
    expect(mockMutateAsync).toHaveBeenCalledTimes(1)

    // Retry: the assignment is re-run, the shift is NOT re-created.
    await user.click(saveButton)
    expect(mockMutateAsync).toHaveBeenCalledTimes(1)
    expect(mockAssignMutateAsync).toHaveBeenCalledTimes(2)
    expect(mockAssignMutateAsync).toHaveBeenLastCalledWith({ shiftId: 's1', candidateId: 'k1' })
  })
})

// E3 audit: the notes field is controlled state that rides into the real save
// payload (PlanningShiftController accepts `notes`) — see the persist describe in
// AddShiftModal.persist.test.tsx for the payload assertion; this only pins that the field is labelled
// and editable.
describe('AddShiftModal · notes field (E3 audit)', () => {
  it('is a labelled, editable field', async () => {
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    const textarea = screen.getByLabelText('notePlaceholder') as HTMLTextAreaElement
    await user.type(textarea, 'Bring own PPE')
    expect(textarea).toHaveValue('Bring own PPE')
  })
})
