/**
 * MatchModal · pickers, defaults and cascades (split from MatchModal.test.tsx): searchable relational pickers, start date, cost-centre cascade, remarks collapse, branch default.
 * Shared fixtures and mocks are duplicated per file (vi.mock must sit in each test file).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchModal from './MatchModal'
import api from '@/lib/api'

// A minimal customer fixture exercising the cost-centre cascade levels: the
// customer's OWN cost centre/billing email/branch, a location that overrides
// cost centre (and carries its own billing_email too — used to prove billing
// does NOT read from it, Danny 2026-07-22), and a location with no cost centre
// of its own (falls back to the customer) — plus one department (job 21/22
// notes departments don't carry these fields yet, a BE gap, so none is seeded
// here). branch_id (job 7.4) is the customer's own establishment — the
// Vestiging picker's default PROPOSAL once this customer is picked. Jan Jansen
// carries email/phone (the duplicate-preflight test's target); Eva Bos appears
// TWICE with different functions (Danny 24-07 live screenshot: same-named
// contacts must stay distinguishable via "Naam — Functietitel").
// EDIT-MATCH-1 (point 2): the candidate.matches row is thin, so opening a match as
// an edit fetches GET /matches/{id} — a mutable holder so individual tests can set
// the fixture the mocked `api.get` below returns for that ONE url prefix; null (the
// reset default) means "not in edit mode", which every OTHER test in this file is.
const { mockCustomer, editMatchFixture, candidateListFixture } = vi.hoisted(() => ({
  editMatchFixture: { current: null as Record<string, unknown> | null },
  // MODAL34-REPAIR: mutable holder for the un-fixed candidate picker's own GET
  // /candidates rows — mirrors editMatchFixture's pattern so one test's row list
  // never leaks into the next (reset in beforeEach below).
  candidateListFixture: { current: null as Array<{ id: string; name: string }> | null },
  mockCustomer: {
    id: 'cust-1', name: 'Zorggroep A',
    cost_center: 'KP-KLANT', billing_email: 'klant@factuur.nl', branch_id: 'branch-1',
    locations: [
      // Two departments here (job C.2.1 regression: the department picker must be
      // searchable too, not just customer/location) — Afdeling A/B.
      { id: 'loc-1', name: 'Locatie Noord', cost_center: 'KP-LOC1', billing_email: 'loc1@factuur.nl', departments: [{ id: 'dep-1', name: 'Afdeling A' }, { id: 'dep-2', name: 'Afdeling B' }] },
      { id: 'loc-2', name: 'Locatie Zuid', departments: [] },
    ],
    contacts: [
      { id: 'con-1', name: 'Jan Jansen', email: 'jan@zorggroep-a.nl', phone: '0101234567' },
      { id: 'con-2', name: 'Marie Bakker' },
      { id: 'con-3', name: 'Eva Bos', function: 'Locatiemanager' },
      { id: 'con-4', name: 'Eva Bos', function: 'Regiomanager' },
    ],
  },
}))

// Overridable per test (default-contract-type preselection, Danny 24-07 point 4) —
// a plain vi.fn() so most tests get the shared baseline below (no default marked)
// while one dedicated test overrides it with an is_default row.
const { useContractTypesMock } = vi.hoisted(() => ({ useContractTypesMock: vi.fn() }))

// Real customer/vacancy/candidate GETs are network-backed react-query hooks —
// mocked directly (no QueryClientProvider needed) so the test isolates this
// component's own wiring, not the shared hooks' fetch behaviour.
// Two users (Danny 24-07 addendum: Recruiter is now searchable too — a second
// name lets a filter test prove typing actually narrows the list).
vi.mock('@/context/LookupsContext', () => ({ useLookups: () => ({ candidateTypes: [] }) }))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }, { id: 'u2', name: 'Sanne Planner' }] }) }))
vi.mock('@/hooks/useCustomerOptions', () => ({
  useCustomerOptions: () => [{ value: 'cust-1', label: 'Zorggroep A' }, { value: 'cust-2', label: 'Andere Zorg BV' }],
}))
vi.mock('../hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], functionOptions: ['Verzorgende IG'].map(n => ({ value: n, label: n })), allowFreeEntry: false }) }))
// options carries a default_duration_days (7.1) so the end-date proposal has
// something to compute from; types stays the plain label list other callers use.
// A second type (ZZP Flex) enables a search/filter test on the now-searchable
// Contractsoort picker without disturbing the end-date-proposal tests below.
vi.mock('@/lib/useContractTypes', () => ({ useContractTypes: useContractTypesMock }))
// Clears call history (api.post, notify*, …) between tests — several new tests
// below assert `.not.toHaveBeenCalledWith(...)`, which needs a clean slate per
// test rather than the accumulated history of every earlier test in this file.
// Implementations (mockReturnValue/the vi.fn() bodies) are untouched by clearAllMocks.
beforeEach(() => {
  vi.clearAllMocks()
  editMatchFixture.current = null // every test defaults to create-mode unless it opts in
  candidateListFixture.current = null // every test defaults to no picker rows unless it opts in
  useContractTypesMock.mockReturnValue({
    types: ['Fase 1-2 z.u.b. (Works)', 'ZZP Flex'],
    options: [
      { value: 'Fase 1-2 z.u.b. (Works)', label: 'Fase 1-2 z.u.b. (Works)', default_duration_days: 30, is_default: false },
      { value: 'ZZP Flex', label: 'ZZP Flex', default_duration_days: null, is_default: false },
    ],
  })
})
// Tenant establishments (7.4) — the Vestiging picker's option list.
vi.mock('@/lib/useLocations', () => ({
  useLocations: () => [{ value: 'branch-1', label: 'Hoofdkantoor' }, { value: 'branch-2', label: 'Bijkantoor' }],
}))
// Read-only recruiter branch fallback (ME-BRANCHES-1) — empty here so the
// customer's own branch (mockCustomer.branch_id) is the proposal under test.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', branch_ids: [] } }) }))
// `@/lib/datetime` (MatchModal's own useDateFormat, VACANCY-PREFILL-1's overlap
// banner) transitively imports the REAL i18n bootstrap (`src/i18n/index.ts`'s
// module-scope `i18n.use(initReactI18next).init(...)`) — the module every OTHER
// candidate test piggybacks a real i18n init on, poisoning every `t()` call in
// this same test process from "return the raw key" to real Dutch strings
// (mirrors WorkTab.test.tsx's identical mock, same reason).
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }),
  useLocale: () => 'nl-NL',
  // Re-exports from localDate module — tests don't use them, but the module imports
  // them for re-export, so the mock must have them to avoid "not exported" errors.
  toLocalIsoDate: () => '',
  humanizeIsoDates: (s: string) => s,
  formatDateOnly: (s: string) => s,
  formatDateTimeStr: (s: string) => s,
  ddmmyyyy: () => '',
  hhmm: () => '',
  hhmmss: () => '',
  formatMonthYear: () => '',
}))
vi.mock('../hooks/useRateProposal', () => ({
  useRateProposal: () => ({ proposal: null, deviatesFromProposal: false, confirmDeviation: false, setConfirmDeviation: vi.fn() }),
}))
vi.mock('@/components/actionrules', () => ({ useActionRulePreflight: () => ({ decision: null }), ActionRuleBanner: () => null }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// Stand-in for the Tiptap editor (its own internals are covered elsewhere) — a
// plain textarea wired to value/onChange, tagged so tests can find it.
// ACTIONS-SCOPE-DEFAULT-FLIP: `assistModes` is surfaced as a data attribute so
// the "Opmerkingen" conversation-mode override can be asserted without
// mounting the real assist bar.
vi.mock('@/components/ui/RichTextEditor', () => ({
  default: ({ value, onChange, assistModes }: { value?: string; onChange: (v: string) => void; assistModes?: string[] }) => (
    <textarea data-testid="rte" value={value ?? ''} onChange={e => onChange(e.target.value)}
      data-assist-modes={assistModes ? assistModes.join(',') : ''} />
  ),
}))

// GET /customers/{id} returns the fixture; GET /candidates/{id} (branch lookup)
// returns an empty candidate so the branch-mismatch banner never triggers. CAO
// (/cao) and contact functions (/contact-functions) fall through to the default
// `{ data: [] }` branch below, so useCao()/useContactFunctions() keep their real
// seed fallbacks (DEFAULT_CAO / DEFAULT_CONTACT_FUNCTIONS) — no extra mock needed.
// `unwrapList` is the REAL implementation (importActual) so those two hooks'
// empty-response parsing stays exactly as production, not a hand-rolled copy.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  const get = vi.fn((url: string) => {
    // MODAL34-REPAIR: only ever hit by the un-fixed candidate picker (candidateListFixture opts in).
    if (url === '/candidates' && candidateListFixture.current) return Promise.resolve({ data: { data: candidateListFixture.current } })
    if (url.startsWith('/customers/')) return Promise.resolve({ data: { data: mockCustomer } })
    if (url.startsWith('/candidates/')) return Promise.resolve({ data: { data: { branch_id: null, location: null } } })
    // EDIT-MATCH-1: only ever hit by editMatchId tests (editMatchFixture opts in).
    if (url.startsWith('/matches/') && editMatchFixture.current) return Promise.resolve({ data: { data: editMatchFixture.current } })
    return Promise.resolve({ data: { data: [] } })
  })
  return {
    ...actual,
    default: { get, post: vi.fn(() => Promise.resolve({ data: { data: { id: 'match-1' } } })), patch: vi.fn(() => Promise.resolve({ data: { data: {} } })) },
    unwrap: (r: { data?: { data?: unknown } }) => r?.data?.data,
  }
})

const noop = () => {}

describe('MatchModal · layout (card-stack canon, Danny 13-08)', () => {
  it('opens WIDE by default (de gedeelde WIDE_MODAL-breedte/92vw) — a 640px default truncated every customer name (Danny 14-08)', async () => {
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    // Let the candidate-branch lookup effect settle before asserting (avoids an
    // act() warning from its microtask resolving after the test body returns).
    const dialogs = await screen.findAllByRole('dialog')
    // POPUP-SLEEP-1: the shared FloatingPanel frame owns the footprint.
    expect(dialogs.some(d => d.style.maxWidth === '92vw' && d.style.width === '1320px')).toBe(true)
  })
})

describe('MatchModal · searchable pickers (job 18)', () => {
  it('the customer picker is a typeable searchable combobox, not a plain select', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.type(screen.getByPlaceholderText('placement.pickCustomer'), 'Andere')
    // Typing filters down to the matching option only.
    expect(screen.getByRole('button', { name: 'Andere Zorg BV' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zorggroep A' })).toBeNull()
  })

  it('is pick-only (allowCreate=false) — typing an unknown value never offers to create it', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.type(screen.getByPlaceholderText('placement.pickCustomer'), 'NoSuchCustomerXYZ')
    expect(screen.queryByText(/NoSuchCustomerXYZ/)).toBeNull()
  })

  it('the location picker becomes searchable once a customer is picked', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickLocation$/ }))
    await user.type(screen.getByPlaceholderText('placement.pickLocation'), 'Noord')
    expect(screen.getByRole('button', { name: 'Locatie Noord' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Locatie Zuid' })).toBeNull()
  })

  // C.2.1 regression: department + contact are the other two of Danny's "all four
  // cascade fields" — both must filter by typing too, not just customer/location.
  // The department picker's empty-state text ("placement.optional") is shared with
  // the Recruiter/Vestiging pickers too (all three are optional CreatableSelects
  // now), so its toggle is found via the field's own label instead of by button name.
  it('the department picker becomes searchable once a location is picked', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickLocation$/ }))
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
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickLocation$/ }))
    await user.click(await screen.findByRole('button', { name: 'Locatie Noord' }))
    const deptField = screen.getByText('placement.department').parentElement as HTMLElement
    await user.click(within(deptField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('placement.optional'), 'NoSuchDepartmentXYZ')
    expect(screen.queryByText(/NoSuchDepartmentXYZ/)).toBeNull()
  })

  it('the contact picker is a typeable searchable combobox once a customer is picked', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickContact$/ }))
    await user.type(screen.getByPlaceholderText('placement.pickContact'), 'Jan')
    expect(screen.getByRole('button', { name: 'Jan Jansen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marie Bakker' })).toBeNull()
  })
})

describe('MatchModal · start date defaults to today (job 19)', () => {
  it('proposes today in the start-date field', async () => {
    const { container } = render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog') // let the candidate-branch lookup settle first
    // LOCAL date, exactly like helpers.ts todayISO — toISOString() is UTC, so between
    // midnight and 02:00 Dutch summer time it returned YESTERDAY and this test failed
    // every night (caught 28-07 at 00:5x). Mirrors the same computation further down.
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const dateInputs = container.querySelectorAll('input[type="date"]')
    expect(dateInputs[0]).toHaveValue(today) // start date (first of the pair)
    expect(dateInputs[1]).toHaveValue('') // end date stays empty
  })
})

describe('MatchModal · cost centre / billing email cascade (job 21/22)', () => {
  it('proposes the customer-level values once the customer is picked', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    expect(await screen.findByDisplayValue('KP-KLANT')).toBeInTheDocument()
    expect(screen.getByDisplayValue('klant@factuur.nl')).toBeInTheDocument()
  })

  it('cost centre follows the deepest picked level (location), but billing email stays the customer\'s (Danny 2026-07-22)', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await screen.findByDisplayValue('KP-KLANT')
    await user.click(screen.getByRole('button', { name: /placement\.pickLocation$/ }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    expect(await screen.findByDisplayValue('KP-LOC1')).toBeInTheDocument()
    // Billing NEVER cascades — the location's own billing_email ('loc1@factuur.nl')
    // must NOT surface here; the customer's stays the only source, always.
    expect(screen.getByDisplayValue('klant@factuur.nl')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('loc1@factuur.nl')).toBeNull()
  })

  it('never overwrites a manually-edited cost centre after a later location pick (the fixed bug)', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickLocation$/ }))
    await user.click(screen.getByRole('button', { name: 'Locatie Noord' }))
    const costInput = await screen.findByDisplayValue('KP-LOC1')
    await user.clear(costInput)
    await user.type(costInput, 'KP-EIGEN')

    // Switch to a location with NO cost centre of its own — previously this
    // effect ran unconditionally and would have overwritten the manual edit.
    await user.click(screen.getByRole('button', { name: /Locatie Noord$/ }))
    await user.click(screen.getByRole('button', { name: 'Locatie Zuid' }))
    expect(screen.getByDisplayValue('KP-EIGEN')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('KP-KLANT')).toBeNull()
  })
})

// Danny 24-07: Opmerkingen starts COLLAPSED (a dashed ghost affordance, never
// the editor itself) and only reveals the shared RichTextEditor — never a bare
// textarea — on an explicit click; it never auto-opens.
describe('MatchModal · opmerkingen starts collapsed (job 23, Danny 24-07)', () => {
  it('does not render the rich-text editor before the recruiter opens it', async () => {
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog') // let the candidate-branch lookup settle first
    expect(screen.queryByTestId('rte')).toBeNull()
    expect(screen.getByRole('button', { name: 'placement.remarksAdd' })).toBeInTheDocument()
  })

  it('reveals the shared RichTextEditor (never a bare textarea) on an explicit click', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'placement.remarksAdd' }))
    expect(screen.getByTestId('rte')).toBeInTheDocument()
  })

  // ACTIONS-SCOPE-DEFAULT-FLIP (Danny 09-08): "Opmerkingen" reads as a
  // conversation, not a description — it must keep Actiepunten even though the
  // shared RichTextAssistBar default is now improve+summarize only.
  it('keeps all three Koios assist modes on Opmerkingen, including Actiepunten (a conversation, not a description)', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'placement.remarksAdd' }))
    expect(screen.getByTestId('rte')).toHaveAttribute('data-assist-modes', 'improve,summarize,actions')
  })
})

// Vestiging default (7.4): proposes the picked customer's own branch, sends it
// as branch_id on POST /matches, and is overridable by hand.
describe('MatchModal · Vestiging default (7.4)', () => {
  const branchField = () => screen.getByText('placement.branch').parentElement as HTMLElement

  it('proposes the customer\'s own branch once the customer is picked', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    expect(await within(branchField()).findByRole('button', { name: /Hoofdkantoor$/ })).toBeInTheDocument()
  })

  it('sends the proposed branch_id on submit', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickFunction$/ }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))
    await within(branchField()).findByRole('button', { name: /Hoofdkantoor$/ })

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    expect(api.post).toHaveBeenCalledWith('/matches', expect.objectContaining({ branch_id: 'branch-1', purchase_order_number: null }))
  })

  // HF-CONTRACT-1: a typed purchase order number travels in the create body as typed.
  it('sends a typed purchase_order_number on create', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickFunction$/ }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))
    await within(branchField()).findByRole('button', { name: /Hoofdkantoor$/ })
    await user.type(screen.getByRole('textbox', { name: 'placement.purchaseOrderNumber' }), 'PO-1')

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    expect(api.post).toHaveBeenCalledWith('/matches', expect.objectContaining({ purchase_order_number: 'PO-1' }))
  })

  it('an overridden branch wins over the proposal', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickFunction$/ }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))
    await within(branchField()).findByRole('button', { name: /Hoofdkantoor$/ })

    // Manual override — picks a different branch than the proposal.
    await user.click(within(branchField()).getByRole('button', { name: /Hoofdkantoor$/ }))
    await user.click(screen.getByRole('button', { name: 'Bijkantoor' }))

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    expect(api.post).toHaveBeenCalledWith('/matches', expect.objectContaining({ branch_id: 'branch-2' }))
  })
})

// End-date proposal from contract type (7.1): proposes start_date + the picked
// type's default_duration_days, and freezes once the recruiter edits it by hand.
