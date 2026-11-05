/**
 * MatchModal · proposals and contacts (split from MatchModal.test.tsx): end-date proposal, 422 mapping, searchable lookups, default contract type, contact function title.
 * Shared fixtures and mocks are duplicated per file (vi.mock must sit in each test file).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
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
    // DROPDOWN-CLEAR-1: filter to the trigger button (has aria-haspopup), not the clear X.
    const ownerButtons = within(ownerField).getAllByRole('button')
    const ownerTrigger = ownerButtons.find(btn => btn.hasAttribute('aria-haspopup'))!
    await user.click(ownerTrigger)
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
