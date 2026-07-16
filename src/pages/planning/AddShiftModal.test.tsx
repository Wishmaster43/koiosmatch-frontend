/**
 * AddShiftModal — PLAN-LOOKUP-1 regression tests. The data hooks (real API
 * calls, covered separately in ./hooks/useShiftLookups.test.tsx) are mocked here
 * so this file stays focused on the modal's own four-UI-states + "no hardcoded
 * demo defaults" behaviour (mirrors VacanciesReport.test.tsx: mock the data
 * layer, assert on the rendered UI). react-i18next is mocked to return the raw
 * key so assertions target stable keys, not locale copy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

const noop = () => {}

beforeEach(() => {
  vi.clearAllMocks()
  mockCustomers.mockReturnValue({ customers: [{ id: 'c1', name: 'Rivas Zorggroep' }, { id: 'c2', name: 'Yesway Zorg' }], loading: false, error: false })
  mockDepartments.mockReturnValue({ departments: [], loading: false, error: false })
  mockCandidates.mockReturnValue({ candidates: [], loading: false, error: false })
})

describe('AddShiftModal · no hardcoded demo defaults (PLAN-LOOKUP-1)', () => {
  it('starts every wired field empty — no "Dagdienst"/"Stichting Rivas Zorggroep" default', () => {
    render(<AddShiftModal date={new Date('2026-07-20')} onClose={noop} onAdd={noop} />)
    expect(screen.getByLabelText('fShiftName')).toHaveValue('')
    expect(screen.getByLabelText('fCustomer')).toHaveValue('')
    expect(screen.getByLabelText('fDepartment')).toHaveValue('')
    expect(screen.getByLabelText('fJobtype')).toHaveValue('')
    expect(screen.queryByText('Stichting Rivas Zorggroep')).not.toBeInTheDocument()
    expect(screen.queryByText('Dagdienst')).not.toBeInTheDocument()
    expect(screen.queryByText('Watertorenlocatie')).not.toBeInTheDocument()
    expect(screen.queryByText('Boezemlaan 4, 2771 VP Boskoop')).not.toBeInTheDocument()
  })
})

describe('AddShiftModal · customer select (real /customers, four states)', () => {
  // Scoped to the select itself (via `within`) — the candidate search panel can
  // legitimately show the same common:loading/noResults text at the same time,
  // so asserting on the page as a whole would be a false-collision risk.
  it('loading: select is disabled and shows the loading placeholder', () => {
    mockCustomers.mockReturnValue({ customers: [], loading: true, error: false })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    const select = screen.getByLabelText('fCustomer')
    expect(select).toBeDisabled()
    expect(within(select).getByText('common:loading')).toBeInTheDocument()
  })

  it('error: shows the generic error placeholder (no fabricated fallback list)', () => {
    mockCustomers.mockReturnValue({ customers: [], loading: false, error: true })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(within(screen.getByLabelText('fCustomer')).getByText('common:errorGeneric')).toBeInTheDocument()
  })

  it('empty: shows the no-results placeholder', () => {
    mockCustomers.mockReturnValue({ customers: [], loading: false, error: false })
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(within(screen.getByLabelText('fCustomer')).getByText('common:noResults')).toBeInTheDocument()
  })

  it('success: real customers render as options; picking one resets the department cascade', async () => {
    const user = userEvent.setup()
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByText('Rivas Zorggroep')).toBeInTheDocument()
    expect(screen.getByText('Yesway Zorg')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('fCustomer'), 'c1')
    expect(screen.getByLabelText('fCustomer')).toHaveValue('c1')
    expect(mockDepartments).toHaveBeenLastCalledWith('c1')
  })
})

describe('AddShiftModal · department select (customer→department cascade)', () => {
  it('prompts to pick a customer first — no separate Location step in this modal', () => {
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByLabelText('fDepartment')).toBeDisabled()
    expect(screen.getByText('pickCustomerFirst')).toBeInTheDocument()
  })
})

describe('AddShiftModal · job-title select (real useFunctions, no default)', () => {
  it('lists tenant functions with nothing pre-selected', () => {
    render(<AddShiftModal date={new Date()} onClose={noop} onAdd={noop} />)
    expect(screen.getByLabelText('fJobtype')).toHaveValue('')
    expect(screen.getByText('Verzorgende IG')).toBeInTheDocument()
    expect(screen.getByText('Helpende')).toBeInTheDocument()
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

  it('selecting a candidate fills the scheduled-worker card and the save payload', async () => {
    mockCandidates.mockReturnValue({ candidates: [{ id: 'k1', name: 'Ismail Eddahchouri', functionTitle: 'IG-Verzorging' }], loading: false, error: false })
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<AddShiftModal date={new Date('2026-07-20')} onClose={noop} onAdd={onAdd} />)

    await user.selectOptions(screen.getByLabelText('fCustomer'), 'c1')
    await user.click(screen.getByText('Ismail Eddahchouri'))
    await user.click(screen.getByText('common:save'))

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      candidate: 'Ismail Eddahchouri',
      location: 'Rivas Zorggroep',
    }))
  })
})
