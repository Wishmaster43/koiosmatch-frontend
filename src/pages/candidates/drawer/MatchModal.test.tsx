/**
 * MatchModal — covers Danny's candidate-100% wave, part 3: the wider
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
 *
 * Danny 24-07 additions: Contractsoort/CAO/Vestiging are now searchable
 * (points 1/2/5), the panel shares its frame with +Kandidaat (point 6), a
 * tenant-marked default contract type PROPOSES into an empty field (point 4),
 * the contact picker shows "Naam — Functietitel" (live screenshot), and the
 * inline new-contact form gained Functie/Telefoon/Mobiel fields plus a
 * duplicate-contact preflight (email/phone/mobile against the loaded contact
 * list — the backend enforces no such uniqueness, verified read-only).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
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
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Piet Recruiter' }, { id: 'u2', name: 'Sanne Planner' }] }) }))
vi.mock('@/pages/vacancies/hooks/useCustomerOptions', () => ({
  useCustomerOptions: () => [{ value: 'cust-1', label: 'Zorggroep A' }, { value: 'cust-2', label: 'Andere Zorg BV' }],
}))
vi.mock('../hooks/useVacancyOptions', () => ({ useVacancyOptions: () => [] }))
vi.mock('@/lib/useFunctions', () => ({ useFunctions: () => ({ functions: ['Verzorgende IG'], allowFreeEntry: false }) }))
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
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }) }))
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

describe('MatchModal · layout (job 17; standardized frame, Danny 24-07 point 6)', () => {
  it('shares the +Kandidaat modal frame footprint (max 1060px / 94vh), not the old narrower panel', async () => {
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    // Let the candidate-branch lookup effect settle before asserting (avoids an
    // act() warning from its microtask resolving after the test body returns).
    const dialogs = await screen.findAllByRole('dialog')
    // POPUP-SLEEP-1: the shared FloatingPanel frame owns the footprint now —
    // WIDE_MODAL width, the panel's own 92vh height cap.
    expect(dialogs.some(d => d.style.maxWidth === '1060px' && d.style.maxHeight === '92vh')).toBe(true)
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
    expect(api.post).toHaveBeenCalledWith('/matches', expect.objectContaining({ branch_id: 'branch-1' }))
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
describe('MatchModal · end-date proposal from contract type (7.1)', () => {
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
    const { container } = render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    const now = new Date()
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

    await user.click(screen.getByRole('button', { name: /placement\.pickContractType$/ }))
    await user.click(await screen.findByRole('button', { name: 'Fase 1-2 z.u.b. (Works)' }))

    const dateInputs = container.querySelectorAll('input[type="date"]')
    expect(dateInputs[1]).toHaveValue(addDays(today, 30))
  })

  it('freezes the end date after a manual edit — picking the type again never overwrites it', async () => {
    const user = userEvent.setup()
    const { container } = render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: /placement\.pickContractType$/ }))
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
describe('MatchModal · 422 field mapping', () => {
  const pickCustomerAndFunction = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickFunction$/ }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))
  }

  it('maps field-level 422 errors onto the corresponding fields', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { errors: { function_title: ['required'], start_date: ['invalid'] } } } })
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await pickCustomerAndFunction(user)

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    // Both function_title→func and start_date→startDate resolve to the shared inline message.
    expect(await screen.findAllByText('required')).toHaveLength(2)
  })

  it('falls back to the server message as a banner when the 422 carries no field errors', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { message: 'Kandidaat is al geplaatst.' } } })
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await pickCustomerAndFunction(user)

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    expect(await screen.findByText('Kandidaat is al geplaatst.')).toBeInTheDocument()
  })
})

// Danny 24-07 points 1/2/5 + addendum: Contractsoort, Vestiging, CAO and
// Recruiter were the remaining non-searchable pickers in this form — all four
// are now the same typeable CreatableSelect (allowCreate=false) as
// customer/location/contact/function.
describe('MatchModal · Contractsoort/Vestiging/CAO/Recruiter are searchable (Danny 24-07 points 1/2/5 + addendum)', () => {
  it('Contractsoort filters by typing and is pick-only', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickContractType$/ }))
    await user.type(screen.getByPlaceholderText('placement.pickContractType'), 'ZZP')
    expect(screen.getByRole('button', { name: /ZZP Flex/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fase 1-2 z.u.b. (Works)' })).toBeNull()
  })

  it('Vestiging filters by typing (was a plain non-searchable SelectMenu)', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    const branchField = screen.getByText('placement.branch').parentElement as HTMLElement
    await user.click(within(branchField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('placement.optional'), 'Bij')
    expect(screen.getByRole('button', { name: 'Bijkantoor' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hoofdkantoor' })).toBeNull()
  })

  it('CAO is searchable (fed by useCao\'s seed fallback) and its picked value rides the POST body', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickFunction$/ }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))

    await user.click(screen.getByRole('button', { name: /placement\.pickCao$/ }))
    await user.type(screen.getByPlaceholderText('placement.pickCao'), 'GGZ')
    expect(screen.getByRole('button', { name: 'GGZ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'VVT' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'GGZ' }))

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    // The lookup's VALUE (slug) rides the body, not the free-typed label the old input sent.
    expect(api.post).toHaveBeenCalledWith('/matches', expect.objectContaining({ cao: 'ggz' }))
  })

  it('Recruiter filters by typing, stays optional, and its picked id rides the POST body', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    const ownerField = screen.getByText('placement.owner').parentElement as HTMLElement
    // RECRUITER-DEFAULT-1 (point 3, VACANCY-PREFILL-1): the field opens
    // PRE-FILLED with the logged-in user (Piet Recruiter, this fixture's `me`) —
    // its own TRIGGER button keeps that name while the dropdown is open, so the
    // "Sanne" search narrowing the LIST OPTIONS to just her is asserted as
    // exactly one remaining match (the trigger), not a second one from a
    // still-listed Piet Recruiter option.
    await user.click(within(ownerField).getByRole('button'))
    await user.type(screen.getByPlaceholderText('placement.optional'), 'Sanne')
    expect(screen.getByRole('button', { name: 'Sanne Planner' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Piet Recruiter$/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Sanne Planner' }))

    // Optional: left untouched, no owner_id rides the body at all.
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickFunction$/ }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))
    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    expect(api.post).toHaveBeenCalledWith('/matches', expect.objectContaining({ owner_id: 'u2' }))
  })
})

// Danny 24-07 point 4: a tenant can mark ONE contract type as its default
// (StatusListEditor's defaultField, mirrors phases/appointment-types) — the form
// preselects it into the empty Contractsoort field, never overwriting a pick.
describe('MatchModal · default contract-type proposal (Danny 24-07 point 4)', () => {
  it('preselects the tenant-marked default contract type', async () => {
    useContractTypesMock.mockReturnValue({
      types: ['Fase 1-2 z.u.b. (Works)', 'ZZP Flex'],
      options: [
        { value: 'Fase 1-2 z.u.b. (Works)', label: 'Fase 1-2 z.u.b. (Works)', default_duration_days: 30, is_default: false },
        { value: 'ZZP Flex', label: 'ZZP Flex', default_duration_days: null, is_default: true },
      ],
    })
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    expect(screen.getByRole('button', { name: /ZZP Flex/ })).toBeInTheDocument()
  })

  it('never overrides a value the recruiter already picked', async () => {
    useContractTypesMock.mockReturnValue({
      types: ['Fase 1-2 z.u.b. (Works)', 'ZZP Flex'],
      options: [
        { value: 'Fase 1-2 z.u.b. (Works)', label: 'Fase 1-2 z.u.b. (Works)', default_duration_days: 30, is_default: false },
        { value: 'ZZP Flex', label: 'ZZP Flex', default_duration_days: null, is_default: true },
      ],
    })
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    // Manually pick the OTHER type before the default would land.
    await user.click(screen.getByRole('button', { name: /ZZP Flex/ }))
    await user.click(await screen.findByRole('button', { name: 'Fase 1-2 z.u.b. (Works)' }))
    expect(screen.getByRole('button', { name: /Fase 1-2 z\.u\.b\. \(Works\)/ })).toBeInTheDocument()
  })
})

// Danny 24-07 live screenshot: the contact picker must show each contact's
// function/job title so same-named contacts (two "Eva Bos") stay distinguishable.
describe('MatchModal · contact picker shows the function title', () => {
  it('renders "Naam — Functietitel" for contacts that carry a function', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickContact$/ }))
    expect(screen.getByRole('button', { name: 'Eva Bos — Locatiemanager' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eva Bos — Regiomanager' })).toBeInTheDocument()
  })

  it('falls back to the bare name — never a dangling dash — when no function is present', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickContact$/ }))
    expect(screen.getByRole('button', { name: 'Jan Jansen' })).toBeInTheDocument()
  })

  it('search also matches the function text, not just the name', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickContact$/ }))
    await user.type(screen.getByPlaceholderText('placement.pickContact'), 'Regiomanager')
    expect(screen.getByRole('button', { name: 'Eva Bos — Regiomanager' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eva Bos — Locatiemanager' })).toBeNull()
  })
})

// Danny 24-07 addendum: the inline new-contact form gained Functie/Telefoon/
// Mobiel fields (all verified-accepted by CustomerContactController's
// validateContact) and a duplicate-contact preflight the backend itself does
// not enforce.
describe('MatchModal · inline new-contact form (Danny 24-07 addendum)', () => {
  const openCreateForm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: 'placement.newContact' }))
  }

  it('sends the new Functie/Telefoon/Mobiel fields on save, coupled to the picked location', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await openCreateForm(user)
    await user.type(screen.getByPlaceholderText('placement.firstName'), 'Piet')
    await user.type(screen.getByPlaceholderText('placement.lastName'), 'Post')
    await user.type(screen.getByPlaceholderText('placement.phone'), '0698765432')
    await user.type(screen.getByPlaceholderText('placement.mobile'), '0611112222')
    await user.click(screen.getByRole('button', { name: 'placement.contactFunction' }))
    await user.click(await screen.findByRole('button', { name: 'Locatiemanager' }))

    await user.click(screen.getByRole('button', { name: 'common:save' }))
    // customer_location_id — NOT the old (silently dropped) location_id key.
    expect(api.post).toHaveBeenCalledWith('/customers/cust-1/contacts', expect.objectContaining({
      first_name: 'Piet', last_name: 'Post', phone: '0698765432', mobile: '0611112222', function: 'Locatiemanager',
    }))
    const [, body] = vi.mocked(api.post).mock.calls.find(c => c[0] === '/customers/cust-1/contacts') ?? []
    expect(body).not.toHaveProperty('location_id')
  })

  it('blocks the save when the phone number already belongs to an existing contact — no request fires', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await openCreateForm(user)
    await user.type(screen.getByPlaceholderText('placement.firstName'), 'Nieuwe')
    await user.type(screen.getByPlaceholderText('placement.lastName'), 'Persoon')
    // Matches Jan Jansen's phone (with spaces/dashes stripped for the comparison).
    await user.type(screen.getByPlaceholderText('placement.phone'), '010-123 4567')

    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(api.post).not.toHaveBeenCalledWith('/customers/cust-1/contacts', expect.anything())
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('blocks the save when the email already belongs to an existing contact', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await openCreateForm(user)
    await user.type(screen.getByPlaceholderText('placement.firstName'), 'Nieuwe')
    await user.type(screen.getByPlaceholderText('placement.lastName'), 'Persoon')
    // Case/whitespace-insensitive match against Jan Jansen's e-mail.
    await user.type(screen.getByPlaceholderText('placement.email'), '  JAN@zorggroep-a.nl  ')

    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(api.post).not.toHaveBeenCalledWith('/customers/cust-1/contacts', expect.anything())
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('does not block on a non-duplicate contact', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await openCreateForm(user)
    await user.type(screen.getByPlaceholderText('placement.firstName'), 'Nieuwe')
    await user.type(screen.getByPlaceholderText('placement.lastName'), 'Persoon')
    await user.type(screen.getByPlaceholderText('placement.phone'), '0699999999')

    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(api.post).toHaveBeenCalledWith('/customers/cust-1/contacts', expect.objectContaining({ first_name: 'Nieuwe', last_name: 'Persoon' }))
  })
})

// Danny 24-07: the "+ e-mail toevoegen" chip must sit in the Facturatie-e-mail
// LABEL row (right-aligned), same placement as "+ nieuw" — not left, under the field.
describe('MatchModal · billing-email "+" button placement (Danny 24-07)', () => {
  it('lives in the same label row as the Facturatie-e-mail label, and adds an email field on click', async () => {
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    const labelRow = screen.getByText('placement.billingEmail').parentElement as HTMLElement
    const addBtn = within(labelRow).getByRole('button', { name: 'placement.addBillingEmail' })
    expect(addBtn).toBeInTheDocument()

    const before = screen.getAllByPlaceholderText(/placement\.billingEmail(Main|Extra)/).length
    await userEvent.setup().click(addBtn)
    expect(screen.getAllByPlaceholderText(/placement\.billingEmail(Main|Extra)/)).toHaveLength(before + 1)
  })
})

// EDIT-MATCH-1 (point 2, Danny live P1): the pencil on a MatchesTab row reopens
// this SAME form with `editMatchId` — the candidate's own embedded `matches` row
// is thin (MATCH-EMBED-1, no match fields), so this fetches GET /matches/{id}
// once and prefills every field from it; submit PATCHes instead of POSTing.
describe('MatchModal · edit mode (point 2, Danny live P1)', () => {
  const editMatch = {
    customer_id: 'cust-1', customer_location_id: 'loc-1', customer_department_id: null,
    contact_id: null, branch_id: 'branch-1', vacancy_id: null,
    owner: { id: 'u2', name: 'Sanne Planner' },
    function_title: 'Verzorgende IG', contract_type: 'Fase 1-2 z.u.b. (Works)',
    start_date: '2026-07-01', end_date: null, hours_per_week: 24,
    cao: 'ggz', scale: null, step: null,
    purchase_rate: 20, sell_rate: 28, cost_center: 'KP-EXISTING',
    billing_emails: ['bestaand@factuur.nl'], remarks: null,
  }

  it('prefills the form from GET /matches/{id} — spot-checks customer/function/cost-centre', async () => {
    editMatchFixture.current = editMatch
    render(<MatchModal candidateId="cand-1" editMatchId="match-1" onClose={noop} onCreated={noop} />)
    // Customer AND function prefill from the fetched record, not the thin row.
    expect(await screen.findByRole('button', { name: /Zorggroep A$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Verzorgende IG$/ })).toBeInTheDocument()
    // Cost centre is a plain input — the loaded value must survive the cascade's
    // OWN "propose from customer" effect (frozen via setCostCenterDirty(true)).
    expect(screen.getByDisplayValue('KP-EXISTING')).toBeInTheDocument()
  })

  it('renders the vacancy field read-only (identity is not editable via PATCH)', async () => {
    editMatchFixture.current = editMatch
    render(<MatchModal candidateId="cand-1" editMatchId="match-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('button', { name: /Zorggroep A$/ })
    // No interactive combobox for Vacature while editing — a plain text value instead.
    expect(screen.queryByRole('button', { name: 'placement.noVacancy' })).toBeNull()
    expect(screen.getByText('placement.noVacancy')).toBeInTheDocument()
  })

  it('submits a PATCH to /matches/{id} with the changed fields, never a POST', async () => {
    editMatchFixture.current = editMatch
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" editMatchId="match-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('button', { name: /Zorggroep A$/ })
    // Change one field by hand before saving.
    const costInput = screen.getByDisplayValue('KP-EXISTING')
    await user.clear(costInput)
    await user.type(costInput, 'KP-NIEUW')

    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(api.patch).toHaveBeenCalledWith('/matches/match-1', expect.objectContaining({
      customer_id: 'cust-1', function_title: 'Verzorgende IG', cost_center: 'KP-NIEUW',
    }))
    // Identity fields never ride a PATCH (UpdateMatchRequest doesn't accept them).
    const [, body] = vi.mocked(api.patch).mock.calls.find(c => c[0] === '/matches/match-1') ?? []
    expect(body).not.toHaveProperty('candidate_id')
    expect(body).not.toHaveProperty('vacancy_id')
    expect(api.post).not.toHaveBeenCalledWith('/matches', expect.anything())
  })
})

// MODAL34-REPAIR (control round): MatchModal wires MATCH-REMARKS-POPOUT onto its
// Opmerkingen card — pins the card heading and that the pop-out affordance really
// depends on a KNOWN candidate id (fixed prop OR a candidate picked through the
// on-page picker), never rendered before one exists (the sync channel has nothing
// to key on otherwise — see MatchModal.tsx's own docblock on `remarksCandidateId`).
describe('MatchModal · Match opmerkingen card + pop-out wiring (MODAL34-REPAIR)', () => {
  it('renders the "Match opmerkingen" card heading', async () => {
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    expect(screen.getByText('placement.matchRemarks')).toBeInTheDocument()
  })

  it('shows the pop-out button once the fixed candidate id is known, after opening the editor', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'placement.remarksAdd' }))
    expect(screen.getByTitle('common:openSecondScreen')).toBeInTheDocument()
  })

  it('renders NO pop-out button while no candidate is known yet (no fixed id, none picked)', async () => {
    const user = userEvent.setup()
    // The Matches page opens this SAME form without a fixed candidateId — a
    // picker appears at the top of Relaties instead (see useMatchForm).
    render(<MatchModal onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'placement.remarksAdd' }))
    expect(screen.queryByTitle('common:openSecondScreen')).not.toBeInTheDocument()
  })

  it('the pop-out button appears the moment a candidate is picked through the on-page picker', async () => {
    // GET /candidates (the un-fixed candidate picker's own option source) — the
    // shared api.get mock reads this fixture for that ONE url, mirroring
    // editMatchFixture's pattern (never a one-off mockImplementation override,
    // which would leak into every later test in this file). Set BEFORE render:
    // the picker's option fetch runs once on mount.
    candidateListFixture.current = [{ id: 'cand-9', name: 'Piet Kandidaat' }]
    const user = userEvent.setup()
    render(<MatchModal onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'placement.remarksAdd' }))
    expect(screen.queryByTitle('common:openSecondScreen')).not.toBeInTheDocument()

    const candidateField = screen.getByText('placement.candidate').parentElement as HTMLElement
    await user.click(within(candidateField).getByRole('button'))
    await user.click(await screen.findByRole('button', { name: 'Piet Kandidaat' }))

    expect(await screen.findByTitle('common:openSecondScreen')).toBeInTheDocument()
  })
})

// MATCH-EXPERIENCE-AUTO-1 (CMBE, 2026-07-25): the backend's MatchMaker now writes
// the work-experience entry itself on every match create — with and without a
// vacancy, idempotent on employer+start date — so the frontend must NEVER post
// one. Replaces the old interim-bridge tests (which asserted the FE posted it).
describe('MatchModal · never posts a work-experience entry (backend owns it, MATCH-EXPERIENCE-AUTO-1)', () => {
  const pickCustomerAndFunction = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /placement\.pickCustomer$/ }))
    await user.click(await screen.findByRole('button', { name: 'Zorggroep A' }))
    await user.click(screen.getByRole('button', { name: /placement\.pickFunction$/ }))
    await user.click(await screen.findByRole('button', { name: 'Verzorgende IG' }))
  }

  it('never posts /candidates/{id}/experiences when creating a match (no vacancy picked)', async () => {
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await pickCustomerAndFunction(user)

    await user.click(screen.getByRole('button', { name: 'placement.create' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/matches', expect.anything()))
    expect(api.post).not.toHaveBeenCalledWith('/candidates/cand-1/experiences', expect.anything())
  })

  it('never posts /candidates/{id}/experiences when editing a match either', async () => {
    editMatchFixture.current = {
      customer_id: 'cust-1', customer_location_id: null, customer_department_id: null,
      contact_id: null, branch_id: null, vacancy_id: null, owner: null,
      function_title: 'Verzorgende IG', contract_type: null, start_date: null, end_date: null,
      hours_per_week: null, cao: null, scale: null, step: null, purchase_rate: null, sell_rate: null,
      cost_center: null, billing_emails: [], remarks: null,
    }
    const user = userEvent.setup()
    render(<MatchModal candidateId="cand-1" editMatchId="match-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('button', { name: /Zorggroep A$/ })
    await user.click(screen.getByRole('button', { name: 'common:save' }))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/matches/match-1', expect.anything()))
    expect(api.post).not.toHaveBeenCalledWith('/candidates/cand-1/experiences', expect.anything())
  })
})
