/**
 * MatchPlacementModal — covers Danny's candidate-100% wave, part 3: the wider
 * two-column panel stays typeable/searchable on the relational pickers (job 17/18,
 * allowCreate={false} — never a free-text create for a real customer/location id),
 * the start date proposes TODAY (job 19), cost centre proposes from the customer→
 * location→department cascade's deepest picked level and FREEZES the moment the
 * recruiter edits it by hand (job 21/22 — the pre-existing bug where a location
 * pick unconditionally clobbered a manual edit); billing email does NOT cascade
 * like that (Danny 2026-07-22) — it is ALWAYS the customer's own address, no
 * matter which location/department is picked, and still freezes on manual edit.
 * Also covers the opmerkingen field being the shared rich-text block, not a bare
 * textarea (job 23), the Vestiging default (7.4: proposes the customer's own
 * branch, overridable, sent as branch_id) and the end-date proposal from the
 * picked contract type's default duration (7.1, freezes on manual edit).
 * RichTextEditor's own Tiptap internals are out of scope here (stubbed, mirrors
 * EditableRichTextField.test.tsx); the relational hooks that hit the network
 * (react-query) are mocked directly so the test doesn't need a QueryClientProvider.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchPlacementModal from './MatchPlacementModal'
import api from '@/lib/api'

// A minimal customer fixture exercising the cost-centre cascade levels: the
// customer's OWN cost centre/billing email/branch, a location that overrides
// cost centre (and carries its own billing_email too — used to prove billing
// does NOT read from it, Danny 2026-07-22), and a location with no cost centre
// of its own (falls back to the customer) — plus one department (job 21/22
// notes departments don't carry these fields yet, a BE gap, so none is seeded
// here). branch_id (job 7.4) is the customer's own establishment — the
// Vestiging picker's default PROPOSAL once this customer is picked.
const { mockCustomer } = vi.hoisted(() => ({
  mockCustomer: {
    id: 'cust-1', name: 'Zorggroep A',
    cost_center: 'KP-KLANT', billing_email: 'klant@factuur.nl', branch_id: 'branch-1',
    locations: [
      // Two departments here (job C.2.1 regression: the department picker must be
      // searchable too, not just customer/location) — Afdeling A/B.
      { id: 'loc-1', name: 'Locatie Noord', cost_center: 'KP-LOC1', billing_email: 'loc1@factuur.nl', departments: [{ id: 'dep-1', name: 'Afdeling A' }, { id: 'dep-2', name: 'Afdeling B' }] },
      { id: 'loc-2', name: 'Locatie Zuid', departments: [] },
    ],
    // Two contacts (same C.2.1 regression, for the contact picker) — Jan/Marie.
    contacts: [{ id: 'con-1', name: 'Jan Jansen' }, { id: 'con-2', name: 'Marie Bakker' }],
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
// options carries a default_duration_days (7.1) so the end-date proposal has
// something to compute from; types stays the plain label list other callers use.
vi.mock('@/lib/useContractTypes', () => ({
  useContractTypes: () => ({
    types: ['Fase 1-2 z.u.b. (Works)'],
    options: [{ value: 'Fase 1-2 z.u.b. (Works)', label: 'Fase 1-2 z.u.b. (Works)', default_duration_days: 30 }],
  }),
}))
// Tenant establishments (7.4) — the Vestiging picker's option list.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'branch-1', label: 'Hoofdkantoor' }, { value: 'branch-2', label: 'Bijkantoor' }],
}))
// Read-only recruiter branch fallback (ME-BRANCHES-1) — empty here so the
// customer's own branch (mockCustomer.branch_id) is the proposal under test.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', branch_ids: [] } }) }))
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

describe('MatchPlacementModal · layout (job 17, widened further at kandidaten-ronde-2 punt C.2.1)', () => {
  it('renders as a wide panel, not the old narrow 560px form', async () => {
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    // Let the candidate-branch lookup effect settle before asserting (avoids an
    // act() warning from its microtask resolving after the test body returns).
    expect(await screen.findByRole('dialog')).toHaveStyle({ width: '900px' })
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

  // C.2.1 regression: department + contact are the other two of Danny's "all four
  // cascade fields" — both must filter by typing too, not just customer/location.
  // The department picker's empty-state text ("placement.optional") is shared with
  // the (non-searchable) owner SelectMenu, so its toggle is found via the field's
  // own label instead of by button name.
  it('the department picker becomes searchable once a location is picked', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: 'placement.pickLocation' }))
    await user.click(await screen.findByRole('button', { name: 'Locatie Noord' }))
    const deptField = screen.getByText('placement.department').parentElement as HTMLElement
    await user.click(within(deptField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('placement.optional'), 'Afdeling A')
    expect(screen.getByRole('button', { name: 'Afdeling A' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Afdeling B' })).toBeNull()
  })

  // Live-check finding (kandidaten-ronde-2 punt C.2.1): the department picker was
  // missing `allowCreate={false}` — every sibling relational picker (customer,
  // location, contact, function, vacancy) already had it, so a department (a real
  // backend id) could be "created" as a free-text value by mistake. Regression guard.
  it('the department picker is pick-only (allowCreate=false) — typing an unknown value never offers to create it', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: 'placement.pickLocation' }))
    await user.click(await screen.findByRole('button', { name: 'Locatie Noord' }))
    const deptField = screen.getByText('placement.department').parentElement as HTMLElement
    await user.click(within(deptField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('placement.optional'), 'NoSuchDepartmentXYZ')
    expect(screen.queryByText(/NoSuchDepartmentXYZ/)).toBeNull()
  })

  it('the contact picker is a typeable searchable combobox once a customer is picked', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: 'placement.pickContact' }))
    await user.type(screen.getByPlaceholderText('placement.pickContact'), 'Jan')
    expect(screen.getByRole('button', { name: 'Jan Jansen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marie Bakker' })).toBeNull()
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

  it('cost centre follows the deepest picked level (location), but billing email stays the customer\'s (Danny 2026-07-22)', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await screen.findByDisplayValue('KP-KLANT')
    await user.click(screen.getByRole('button', { name: 'placement.pickLocation' }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    expect(await screen.findByDisplayValue('KP-LOC1')).toBeInTheDocument()
    // Billing NEVER cascades — the location's own billing_email ('loc1@factuur.nl')
    // must NOT surface here; the customer's stays the only source, always.
    expect(screen.getByDisplayValue('klant@factuur.nl')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('loc1@factuur.nl')).toBeNull()
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

// Vestiging default (7.4): proposes the picked customer's own branch, sends it
// as branch_id on POST /matches, and is overridable by hand.
describe('MatchPlacementModal · Vestiging default (7.4)', () => {
  const branchField = () => screen.getByText('placement.branch').parentElement as HTMLElement

  it('proposes the customer\'s own branch once the customer is picked', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    expect(await within(branchField()).findByRole('button', { name: 'Hoofdkantoor' })).toBeInTheDocument()
  })

  it('sends the proposed branch_id on submit', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: 'placement.pickFunction' }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))
    await within(branchField()).findByRole('button', { name: 'Hoofdkantoor' })

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    expect(api.post).toHaveBeenCalledWith('/matches', expect.objectContaining({ branch_id: 'branch-1' }))
  })

  it('an overridden branch wins over the proposal', async () => {
    const user = userEvent.setup()
    render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: 'placement.pickCustomer' }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: 'placement.pickFunction' }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))
    await within(branchField()).findByRole('button', { name: 'Hoofdkantoor' })

    // Manual override — picks a different branch than the proposal.
    await user.click(within(branchField()).getByRole('button', { name: 'Hoofdkantoor' }))
    await user.click(screen.getByRole('button', { name: 'Bijkantoor' }))

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    expect(api.post).toHaveBeenCalledWith('/matches', expect.objectContaining({ branch_id: 'branch-2' }))
  })
})

// End-date proposal from contract type (7.1): proposes start_date + the picked
// type's default_duration_days, and freezes once the recruiter edits it by hand.
describe('MatchPlacementModal · end-date proposal from contract type (7.1)', () => {
  // Local date getters (never toISOString(), which round-trips through UTC and
  // drifts a calendar day in CEST/Europe timezones) — mirrors the production
  // helpers.ts addDays/todayISO exactly.
  const pad = (n: number) => String(n).padStart(2, '0')
  const addDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00`)
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  it('proposes start date + the contract type\'s default duration', async () => {
    const user = userEvent.setup()
    const { container } = render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    const now = new Date()
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

    await user.click(screen.getByRole('button', { name: 'placement.pickContractType' }))
    await user.click(await screen.findByRole('button', { name: 'Fase 1-2 z.u.b. (Works)' }))

    const dateInputs = container.querySelectorAll('input[type="date"]')
    expect(dateInputs[1]).toHaveValue(addDays(today, 30))
  })

  it('freezes the end date after a manual edit — picking the type again never overwrites it', async () => {
    const user = userEvent.setup()
    const { container } = render(<MatchPlacementModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'placement.pickContractType' }))
    await user.click(await screen.findByRole('button', { name: 'Fase 1-2 z.u.b. (Works)' }))
    const dateInputs = container.querySelectorAll('input[type="date"]')
    const endDateInput = dateInputs[1] as HTMLInputElement

    // fireEvent (not userEvent.type) — native date inputs take a whole value per
    // change, not a per-keystroke sequence.
    fireEvent.change(endDateInput, { target: { value: '2030-01-15' } })
    expect(endDateInput).toHaveValue('2030-01-15')

    // Re-picking the start date would normally re-trigger the proposal — the
    // manual edit must freeze it regardless.
    const startDateInput = dateInputs[0] as HTMLInputElement
    fireEvent.change(startDateInput, { target: { value: '2026-08-01' } })
    expect(endDateInput).toHaveValue('2030-01-15')
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
