/**
 * AddShiftModal — PLAN-LOOKUP-1 regression tests, updated for the house
 * CreatableSelect conversion (Danny 27-07: "+ dienst ook nalopen" — every
 * bare `<select>` becomes a searchable picker, mirrors AddCandidateModal.test).
 * The data hooks (real API calls, covered separately in
 * ./hooks/useShiftLookups.test.tsx) are mocked here so this file stays focused
 * on the modal's own four-UI-states + "no hardcoded demo defaults" behaviour.
 * react-i18next is mocked to return the raw key so assertions target stable
 * keys, not locale copy. CreatableSelect renders its own accessible tree (a
 * trigger `<button>` showing the current label/placeholder + an options list
 * revealed on click), so pickers are queried by role/name, not getByLabelText
 * (that still works for the plain `<input>`/`<textarea>` fields, unchanged).
 *
 * PLANNING-PERSIST-1-staart (CMFE audit 2026-09-04): Save now really POSTs to
 * /planning/shifts (useCreatePlanningShift, mocked here so this file stays
 * about the modal's own rendering behaviour — the request itself is covered
 * request-level in ./hooks/usePlanningShifts.test.tsx). Save is disabled only
 * while no order is picked; the old permanent-disabled + preview-notice tests
 * are replaced by that gate plus a real-save assertion.
 *
 * PLANNING-PERSIST-1-staart fixronde (same day): three more regressions —
 * (1) the department picker follows the SELECTED ORDER's own customer, not an
 * independently-picked one (PlanningShiftController validates the two
 * together); (2) Save also stays gated while the number-of-people field is
 * cleared (a numeric state var made `Number('')` a silent fake `0`); (3) the
 * save-failure notice carries `role="alert"`.
 */
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
const jobtypeTrigger  = () => screen.getByRole('button', { name: 'fJobtype' })

describe('AddShiftModal · no hardcoded demo defaults (PLAN-LOOKUP-1)', () => {
  it('starts every wired field empty — no "Dagdienst"/"Stichting Rivas Zorggroep" default', () => {
    renderModal(<AddShiftModal date={new Date('2026-07-20')} onClose={noop} onAdd={noop} />)
    expect(screen.getByLabelText('fShiftName')).toHaveValue('')
    expect(customerTrigger()).toBeInTheDocument()
    expect(jobtypeTrigger()).toBeInTheDocument()
    expect(screen.queryByText('Stichting Rivas Zorggroep')).not.toBeInTheDocument()
    expect(screen.queryByText('Dagdienst')).not.toBeInTheDocument()
    expect(screen.queryByText('Watertorenlocatie')).not.toBeInTheDocument()
    expect(screen.queryByText('Boezemlaan 4, 2771 VP Boskoop')).not.toBeInTheDocument()
  })
})

describe('AddShiftModal · titled cards (Danny 27-07 house frame)', () => {
  it('groups the order/location/colour fields into titled cards', () => {
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('sectionOrder')).toBeInTheDocument()
    expect(screen.getByText('sectionLocation')).toBeInTheDocument()
    expect(screen.getByText('sectionColor')).toBeInTheDocument()
    expect(screen.getByText('shift1')).toBeInTheDocument()
  })

  it('Esc closes the modal via the focus trap', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date()} onClose={onClose} onAdd={noop} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('AddShiftModal · customer picker (real /customers, four states, now searchable)', () => {
  it('loading: trigger shows the loading placeholder', () => {
    mockCustomers.mockReturnValue({ customers: [], loading: true, error: false })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    // Trigger's name is the static field label now — assert the placeholder via its text.
    expect(customerTrigger()).toHaveTextContent('common:loading')
  })

  it('error: shows the generic error placeholder (no fabricated fallback list)', () => {
    mockCustomers.mockReturnValue({ customers: [], loading: false, error: true })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(customerTrigger()).toHaveTextContent('common:errorGeneric')
  })

  it('empty: shows the no-results placeholder', () => {
    mockCustomers.mockReturnValue({ customers: [], loading: false, error: false })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(customerTrigger()).toHaveTextContent('common:noResults')
  })

  it('success: opening the picker lists real customers; picking one resets the department cascade', async () => {
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    await user.click(customerTrigger())
    expect(screen.getByRole('button', { name: 'Rivas Zorggroep' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yesway Zorg' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rivas Zorggroep' }))
    // Trigger's name stays the field label; assert the selection via its text.
    expect(customerTrigger()).toHaveTextContent('Rivas Zorggroep')
    expect(mockDepartments).toHaveBeenLastCalledWith('c1')
  })

  it('searchable: typing filters the option list (house searchable-picker requirement)', async () => {
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    await user.click(customerTrigger())
    await user.type(screen.getByPlaceholderText('common:select'), 'Yesway')
    expect(screen.getByRole('button', { name: 'Yesway Zorg' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rivas Zorggroep' })).not.toBeInTheDocument()
  })
})

describe('AddShiftModal · order picker (PLANNING-ORDER-CREATE-1, real /planning/orders, no demo rows)', () => {
  const orderTrigger = () => screen.getByRole('button', { name: 'order.listTitle' })

  it('empty: shows the no-results placeholder when there are no real orders yet', () => {
    mockOrders.mockReturnValue({ orders: [], loading: false, error: false })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(orderTrigger()).toHaveTextContent('common:noResults')
  })

  it('success: a freshly created order is immediately selectable', async () => {
    const user = userEvent.setup()
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'ICU dayshift', status: 'open', shifts_count: 0 }], loading: false, error: false })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    await user.click(orderTrigger())
    await user.click(screen.getByRole('button', { name: 'ICU dayshift' }))
    expect(orderTrigger()).toHaveTextContent('ICU dayshift')
  })
})

describe('AddShiftModal · department picker (customer→department cascade)', () => {
  it('prompts to pick a customer first — no separate Location step in this modal', () => {
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    // Trigger's name is the static field label; assert the placeholder via its text.
    expect(screen.getByRole('button', { name: 'fDepartment' })).toHaveTextContent('pickCustomerFirst')
  })
})

// PLANNING-PERSIST-1-staart fixronde: PlanningShiftController validates
// customer_department_id against the ORDER's own customer, so department
// options must follow the picked ORDER, never an independently-picked customer
// that could disagree with it.
describe('AddShiftModal · department scoped to the picked ORDER (PLANNING-PERSIST-1-staart fixronde)', () => {
  it('picking an order fetches departments for the ORDER\'s own customer, not a manually picked one', async () => {
    const user = userEvent.setup()
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'ICU dayshift', customer_id: 'c9', status: 'open', shifts_count: 0 }], loading: false, error: false })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    await user.click(screen.getByRole('button', { name: 'order.listTitle' }))
    await user.click(screen.getByRole('button', { name: 'ICU dayshift' }))
    expect(mockDepartments).toHaveBeenLastCalledWith('c9')
    // No manual customer was picked — the department field is no longer stuck
    // on "pick a customer first" once an order supplies one.
    expect(screen.getByRole('button', { name: 'fDepartment' })).not.toHaveTextContent('pickCustomerFirst')
  })

  it('switching to a different order resets a previously picked department', async () => {
    const user = userEvent.setup()
    mockOrders.mockReturnValue({ orders: [
      { id: 'o1', subject: 'ICU dayshift', customer_id: 'c1', status: 'open', shifts_count: 0 },
      { id: 'o2', subject: 'ER nightshift', customer_id: 'c2', status: 'open', shifts_count: 0 },
    ], loading: false, error: false })
    mockDepartments.mockReturnValue({ departments: [{ id: 'd1', name: 'ICU ward' }], loading: false, error: false })
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)

    await user.click(screen.getByRole('button', { name: 'order.listTitle' }))
    await user.click(screen.getByRole('button', { name: 'ICU dayshift' }))
    await user.click(screen.getByRole('button', { name: 'fDepartment' }))
    await user.click(screen.getByRole('button', { name: 'ICU ward' }))
    expect(screen.getByRole('button', { name: 'fDepartment' })).toHaveTextContent('ICU ward')

    // A different order can belong to a different customer — the previously
    // picked department (which may not exist for c2) must not silently ride along.
    // The order trigger's accessible name stays the static field label even
    // after a pick (see the top-of-file note on customerTrigger/jobtypeTrigger).
    await user.click(screen.getByRole('button', { name: 'order.listTitle' }))
    await user.click(screen.getByRole('button', { name: 'ER nightshift' }))
    expect(mockDepartments).toHaveBeenLastCalledWith('c2')
    expect(screen.getByRole('button', { name: 'fDepartment' })).not.toHaveTextContent('ICU ward')
  })
})

describe('AddShiftModal · job-title picker (real useFunctions, no default, searchable)', () => {
  it('lists tenant functions with nothing pre-selected', async () => {
    const user = userEvent.setup()
    renderModal(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    await user.click(jobtypeTrigger())
    expect(screen.getByRole('button', { name: 'Verzorgende IG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Helpende' })).toBeInTheDocument()
  })
})

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
})

// E3 audit: the notes field is controlled state that rides into the real save
// payload (PlanningShiftController accepts `notes`) — see the persist describe
// below for the payload assertion; this only pins that the field is labelled
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
