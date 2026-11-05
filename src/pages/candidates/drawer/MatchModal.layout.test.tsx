/** MatchModal · remarks pop-out, no work-experience post, card-stack layout (split from MatchModal.test.tsx; the inline contact, billing-email and edit-mode tests stay there). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
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
// Contractsoort picker without disturbing the end-date-proposal tests (MatchModal.proposals.test.tsx).
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
    // which would leak into every later test in this file). PRIV-1: the picker no
    // longer fetches on mount (data minimisation, §8) — it only fetches once the
    // recruiter has typed >= CANDIDATE_SEARCH_MIN_CHARS, so the fixture is read
    // regardless of when it is set, but the test must actually type first.
    candidateListFixture.current = [{ id: 'cand-9', name: 'Piet Kandidaat' }]
    const user = userEvent.setup()
    render(<MatchModal onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'placement.remarksAdd' }))
    expect(screen.queryByTitle('common:openSecondScreen')).not.toBeInTheDocument()

    const candidateField = screen.getByText('placement.candidate').parentElement as HTMLElement
    await user.click(within(candidateField).getByRole('button'))
    // The popover's own search input carries the hint as its OWN placeholder/
    // aria-label (RelationsSection.tsx: `t('candidates:merge.searchHint', …)`) —
    // type >= 2 chars (PRIV-1's CANDIDATE_SEARCH_MIN_CHARS) to trigger the
    // debounced fetch. The popover is portalled to document.body (not inside
    // candidateField's own subtree), so scope by its distinct accessible name
    // instead of by container.
    const searchInput = screen.getByRole('textbox', { name: /searchHint/ })
    await user.type(searchInput, 'Pi')
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

// CARD-STACK-LABEL-LEFT regression (Danny 13-08): pins the rebuilt structure —
// four titled cards, single column, and every field its own label-LEFT row
// (the label element precedes its field in the DOM, both inside one row).
describe('MatchModal · card-stack layout (Danny 13-08)', () => {
  it('renders all four titled cards — Relaties, Contract, Financieel, Opmerkingen', async () => {
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    for (const key of ['placement.relations', 'placement.contract', 'placement.financial', 'placement.matchRemarks']) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
  })

  it('renders the customer field as a label-left row — label precedes the field in the same row', async () => {
    render(<MatchModal candidateId="cand-1" onClose={noop} onCreated={noop} />)
    await screen.findByRole('dialog')
    const label = screen.getByText('placement.customer')
    const field = screen.getByRole('button', { name: /placement\.pickCustomer$/ })
    // Label and field share one row container (the label-left row), with the
    // label appearing FIRST in DOM order (left-to-right reading order).
    const row = label.closest('div')?.parentElement
    expect(row).toContainElement(field)
    const position = label.compareDocumentPosition(field)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
