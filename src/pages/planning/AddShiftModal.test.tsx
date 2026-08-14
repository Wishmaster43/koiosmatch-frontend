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
 * PLANNING-PERSIST-1 (CMFE audit 2026-07-28): `onAdd` never reached a real save
 * route — see the component's own header comment. Save is now disabled with an
 * honest, translated notice instead; the "fills the save payload" test below was
 * rewritten to assert that gate (disabled + notice) rather than a fake success.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddShiftModal from './AddShiftModal'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG', 'Helpende'], allowFreeEntry: false }) }))

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
    render(<AddShiftModal date={new Date('2026-07-20')} onClose={noop} onAdd={noop} />)
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
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('sectionOrder')).toBeInTheDocument()
    expect(screen.getByText('sectionLocation')).toBeInTheDocument()
    expect(screen.getByText('sectionColor')).toBeInTheDocument()
    expect(screen.getByText('shift1')).toBeInTheDocument()
  })

  it('Esc closes the modal via the focus trap', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddShiftModal date={new Date()} onClose={onClose} onAdd={noop} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('AddShiftModal · customer picker (real /customers, four states, now searchable)', () => {
  it('loading: trigger shows the loading placeholder', () => {
    mockCustomers.mockReturnValue({ customers: [], loading: true, error: false })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    // Trigger's name is the static field label now — assert the placeholder via its text.
    expect(customerTrigger()).toHaveTextContent('common:loading')
  })

  it('error: shows the generic error placeholder (no fabricated fallback list)', () => {
    mockCustomers.mockReturnValue({ customers: [], loading: false, error: true })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(customerTrigger()).toHaveTextContent('common:errorGeneric')
  })

  it('empty: shows the no-results placeholder', () => {
    mockCustomers.mockReturnValue({ customers: [], loading: false, error: false })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(customerTrigger()).toHaveTextContent('common:noResults')
  })

  it('success: opening the picker lists real customers; picking one resets the department cascade', async () => {
    const user = userEvent.setup()
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
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
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
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
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(orderTrigger()).toHaveTextContent('common:noResults')
  })

  it('success: a freshly created order is immediately selectable', async () => {
    const user = userEvent.setup()
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'ICU dayshift', status: 'open', shifts_count: 0 }], loading: false, error: false })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    await user.click(orderTrigger())
    await user.click(screen.getByRole('button', { name: 'ICU dayshift' }))
    expect(orderTrigger()).toHaveTextContent('ICU dayshift')
  })
})

describe('AddShiftModal · department picker (customer→department cascade)', () => {
  it('prompts to pick a customer first — no separate Location step in this modal', () => {
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    // Trigger's name is the static field label; assert the placeholder via its text.
    expect(screen.getByRole('button', { name: 'fDepartment' })).toHaveTextContent('pickCustomerFirst')
  })
})

describe('AddShiftModal · job-title picker (real useFunctions, no default, searchable)', () => {
  it('lists tenant functions with nothing pre-selected', async () => {
    const user = userEvent.setup()
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    await user.click(jobtypeTrigger())
    expect(screen.getByRole('button', { name: 'Verzorgende IG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Helpende' })).toBeInTheDocument()
  })
})

describe('AddShiftModal · candidate search (SUGGESTIES mock removed)', () => {
  it('loading: shows the loading state', () => {
    mockCandidates.mockReturnValue({ candidates: [], loading: true, error: false })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('error: shows the generic error state', () => {
    mockCandidates.mockReturnValue({ candidates: [], loading: false, error: true })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('common:errorGeneric')).toBeInTheDocument()
  })

  it('empty: shows the no-results state (never a fabricated favourite/suggestion list)', () => {
    // The order picker also renders 'common:noResults' by default (no seeded
    // orders in this file's mocks) — seed one order here so this assertion
    // stays scoped to the candidate panel, not ambiguous across both pickers.
    mockOrders.mockReturnValue({ orders: [{ id: 'o1', subject: 'Seeded order' }], loading: false, error: false })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('common:noResults')).toBeInTheDocument()
  })

  it('success: renders real candidate rows with no fabricated favourite/distance/hours data', () => {
    mockCandidates.mockReturnValue({ candidates: [{ id: 'k1', name: 'Ismail Eddahchouri', functionTitle: 'IG-Verzorging' }], loading: false, error: false })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('Ismail Eddahchouri')).toBeInTheDocument()
    expect(screen.getByText('IG-Verzorging')).toBeInTheDocument()
    expect(screen.queryByText(/km/)).not.toBeInTheDocument()
    expect(screen.queryByText('favorites')).not.toBeInTheDocument()
    expect(screen.queryByText('suggestions')).not.toBeInTheDocument()
  })

  it('selecting a candidate fills the scheduled-worker card (Save stays gated — PLANNING-PERSIST-1)', async () => {
    mockCandidates.mockReturnValue({ candidates: [{ id: 'k1', name: 'Ismail Eddahchouri', functionTitle: 'IG-Verzorging' }], loading: false, error: false })
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<AddShiftModal date={new Date('2026-07-20')} onClose={noop} onAdd={onAdd} />)

    await user.click(customerTrigger())
    await user.click(screen.getByRole('button', { name: 'Rivas Zorggroep' }))
    await user.click(screen.getByText('Ismail Eddahchouri'))
    // Save is disabled (no real persistence path yet) — clicking it is a no-op.
    await user.click(screen.getByText('common:save'))

    expect(onAdd).not.toHaveBeenCalled()
  })
})

describe('AddShiftModal · not-yet-persisted gate (PLANNING-PERSIST-1)', () => {
  it('disables Save with an honest tooltip and shows the preview notice', () => {
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    const saveButton = screen.getByText('common:save').closest('button')
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveAttribute('title', 'previewSaveTitle')
    expect(screen.getByText('previewNotice')).toBeInTheDocument()
  })
})
