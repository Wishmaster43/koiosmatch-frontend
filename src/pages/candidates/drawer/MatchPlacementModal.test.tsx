/**
 * MatchPlacementModal — covers Danny's candidate-100% wave, part 3: the wider
 * two-column panel stays typeable/searchable on the relational pickers (job 17/18,
 * allowCreate={false} — never a free-text create for a real customer/location id),
 * the start date proposes TODAY (job 19), cost centre + billing email propose from
 * the customer→location cascade and FREEZE the moment the recruiter edits them by
 * hand (job 21/22 — the pre-existing bug where a location pick unconditionally
 * clobbered a manual edit), and the opmerkingen field is the shared rich-text
 * block, not a bare textarea (job 23). RichTextEditor's own Tiptap internals are
 * out of scope here (stubbed, mirrors EditableRichTextField.test.tsx); the
 * relational hooks that hit the network (react-query) are mocked directly so the
 * test doesn't need a QueryClientProvider.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchPlacementModal from './MatchPlacementModal'
import api from '@/lib/api'

// A minimal customer fixture exercising all three cascade levels: the customer's
// OWN cost centre/billing email, a location that overrides both, and a location
// with neither (falls back to the customer) — plus one department (job 21/22 notes
// departments don't carry these fields yet, a BE gap, so none is seeded here).
const { mockCustomer } = vi.hoisted(() => ({
  mockCustomer: {
    id: 'cust-1', name: 'Zorggroep A',
    cost_center: 'KP-KLANT', billing_email: 'klant@factuur.nl', branch_id: null,
    locations: [
      { id: 'loc-1', name: 'Locatie Noord', cost_center: 'KP-LOC1', billing_email: 'loc1@factuur.nl', departments: [{ id: 'dep-1', name: 'Afdeling A' }] },
      { id: 'loc-2', name: 'Locatie Zuid', departments: [] },
    ],
    contacts: [{ id: 'con-1', name: 'Jan Jansen' }],
  },
}))

// Real customer/vacancy/candidate GETs are network-backed react-query hooks —
// mocked directly (no QueryClientProvider needed) so the test isolates this
// component's own wiring, not the shared hooks' fetch behaviour.
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }] }) }))
vi.mock('@/pages/vacancies/hooks/useCustomerOptions', () => ({
  useCustomerOptions: () => [{ value: 'cust-1', label: 'Zorggroep A' }, { value: 'cust-2', label: 'Andere Zorg BV' }],
}))
vi.mock('../hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], allowFreeEntry: false }) }))
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: () => ({ types: ['Fase 1-2 z.u.b. (Works)'] }) }))
vi.mock('../hooks/useRateProposal', () => ({
  useRateProposal: () => ({ proposal: null, deviatesFromProposal: false, confirmDeviation: false, setConfirmDeviation: vi.fn() }),
}))
vi.mock('@/components/actionrules', () => ({ useActionRulePreflight: () => ({ decision: null }), ActionRuleBanner: () => null }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// Stand-in for the Tiptap editor (its own internals are covered elsewhere) — a
// plain textarea wired to value/onChange, tagged so tests can find it.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  ),
}))

// GET /customers/{id} returns the fixture; GET /candidates/{id} (branch lookup)
// returns an empty candidate so the branch-mismatch banner never triggers.
vi.mock('@/lib/api', () => {
  const get = vi.fn((url: string) => {
    if (url.startsWith('/customers/')) return Promise.resolve({ data: { data: mockCustomer } })
    if (url.startsWith('/candidates/')) return Promise.resolve({ data: { data: { branch_id: null, location: null } } })
    return Promise.resolve({ data: { data: [] } })
  })
  return {
    default: { get, post: vi.fn(() => Promise.resolve({ data: { data: { id: 'match-1' } } })), patch: vi.fn(() => Promise.resolve({ data: { data: {} } })) },
    unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  }
})

const noop = () => {}

describe('MatchPlacementModal · layout (job 17)', () => {
  it('renders as a wide two-column panel, not the old narrow 560px form', async () => {
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    // Let the candidate-branch lookup effect settle before asserting (avoids an
    // act() warning from its microtask resolving after the test body returns).
    expect(await screen.findByRole('dialog')).toHaveStyle({ width: '720px' })
  })
})

describe('MatchPlacementModal · searchable pickers (job 18)', () => {
  it('the customer picker is a typeable searchable combobox, not a plain select', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.type(screen.getByPlaceholderText('placement.pickCustomer'), 'Andere')
    // Typing filters down to the matching option only.
    expect(screen.getByRole('button', { name: 'Andere Zorg BV' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zorggroep A' })).toBeNull()
  })

  it('is pick-only (allowCreate=false) — typing an unknown value never offers to create it', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.type(screen.getByPlaceholderText('placement.pickCustomer'), 'NoSuchCustomerXYZ')
    expect(screen.queryByText(/NoSuchCustomerXYZ/)).toBeNull()
  })

  it('the location picker becomes searchable once a customer is picked', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: 'placement.pickLocation' }))
    await user.type(screen.getByPlaceholderText('placement.pickLocation'), 'Noord')
    expect(screen.getByRole('button', { name: 'Locatie Noord' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Locatie Zuid' })).toBeNull()
  })
})

describe('MatchPlacementModal · start date defaults to today (job 19)', () => {
  it('proposes today in the start-date field', async () => {
    const { container } = render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog') // let the candidate-branch lookup settle first
    const today = new Date().toISOString().slice(0, 10)
    const dateInputs = container.querySelectorAll('input[type="date"]')
    expect(dateInputs[0]).toHaveValue(today) // start date (first of the pair)
    expect(dateInputs[1]).toHaveValue('') // end date stays empty
  })
})

describe('MatchPlacementModal · cost centre / billing email cascade (job 21/22)', () => {
  it('proposes the customer-level values once the customer is picked', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    expect(await screen.findByDisplayValue('KP-KLANT')).toBeInTheDocument()
    expect(screen.getByDisplayValue('klant@factuur.nl')).toBeInTheDocument()
  })

  it('the deepest picked level (location) overrides the customer default', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await screen.findByDisplayValue('KP-KLANT')
    await user.click(screen.getByRole('button', { name: 'placement.pickLocation' }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    expect(await screen.findByDisplayValue('KP-LOC1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('loc1@factuur.nl')).toBeInTheDocument()
  })

  it('never overwrites a manually-edited cost centre after a later location pick (the fixed bug)', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: 'placement.pickLocation' }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    const costInput = await screen.findByDisplayValue('KP-LOC1')
    await user.clear(costInput)
    await user.type(costInput, 'KP-EIGEN')

    // Switch to a location with NO cost centre of its own — previously this
    // effect ran unconditionally and would have overwritten the manual edit.
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    expect(screen.getByDisplayValue('KP-EIGEN')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('KP-KLANT')).toBeNull()
  })
})

describe('MatchPlacementModal · opmerkingen is the shared rich-text block (job 23)', () => {
  it('renders the shared RichTextEditor instead of a bare textarea', async () => {
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog') // let the candidate-branch lookup settle first
    expect(screen.getByTestId('rte')).toBeInTheDocument()
  })
})

// Regression: the catch used to only fire a generic toast — mirrors the house
// 422 pattern (AddCandidateModal/AddCustomerModal): map errors.{field} onto the
// matching field, fall back to a server message/generic banner otherwise.
describe('MatchPlacementModal · 422 field mapping', () => {
  const pickCustomerAndFunction = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: 'placement.pickFunction' }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))
  }

  it('maps field-level 422 errors onto the corresponding fields', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { errors: { function_title: ['required'], start_date: ['invalid'] } } } })
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await pickCustomerAndFunction(user)

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    // Both function_title→func and start_date→startDate resolve to the shared inline message.
    expect(await screen.findAllByText('required')).toHaveLength(2)
  })

  it('falls back to the server message as a banner when the 422 carries no field errors', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: 'Kandidaat is al geplaatst.' } } })
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await pickCustomerAndFunction(user)

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    expect(await screen.findByText('Kandidaat is al geplaatst.')).toBeInTheDocument()
  })
})
