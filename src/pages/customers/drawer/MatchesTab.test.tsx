/**
 * MatchesTab (customer drawer) — mirrors candidates/drawer/MatchesTab.test.tsx's
 * own coverage: empty state, the real-anchor "Open match" affordance, and the
 * four explicit UI states (§3). The one behavioural difference from the
 * candidate tab is proven here too: this tab's CARD is read-only — no pencil,
 * ever (a match's fields are opened/edited in its own drawer, never from this
 * list) — but point 1 (Danny's ten-point round) now adds a "+ Match" trigger
 * to the toolbar itself, opening MatchModal already scoped to this customer.
 *
 * The card BODY moved into the shared `MatchCard` (point 2/4/5/6) — its own
 * test file (MatchCard.test.tsx) covers the title-merge/Periode/Functie/
 * Vestiging/Eigenaar/expiry-chip behaviour in isolation; this file only proves
 * this tab wires the right DATA into that shared card.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Side-effect import: the real i18next instance, so useTranslation resolves
// actual copy (mirrors VacanciesTab.test.tsx) instead of warning/returning keys.
import '@/i18n'
import i18n from '@/i18n'
import MatchesTab from './MatchesTab'
import type { CustomerMatchRow } from '../hooks/useCustomerDrawerData'

// The lookup's own fetch/resolution is out of scope here (mirrors the candidate
// test) — a controlled meta resolver proves the card prefers it over the raw row.
// STATUSES (MATCHES-TOOLBAR-1): a real (non-empty) list so the StatusFilterSelect
// toolbar has real options to filter/pick from.
// eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
const metaOf = vi.fn((v?: string) => (v === 'open' ? { value: 'open', label: 'Open (lookup)', color: '#123456', is_closed: false } : undefined))
// Deliberately NOT 'open'/'active'/'actief' — useStatusFilter's shared guess
// heuristic (isActiveValue) auto-proposes a status with one of those slugs as the
// DEFAULT filter (same behaviour as Locations/Departments/Vacancies today), which
// would make "nothing picked = all" below false. Neutral slugs isolate the NEW
// toolbar behaviour from that pre-existing, unrelated guess.
// eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
const statuses = [
  { value: 'pending', label: 'In behandeling', color: '#123456', is_closed: false },
  { value: 'confirmed', label: 'Bevestigd', color: '#789ABC', is_closed: true },
]
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses, metaOf }) }))
// Neither backoffice system enabled by default — BackofficeCouplingIndicator
// stays out of the header (mirrors a tenant running neither connector).
vi.mock('@/context/AppsContext', () => ({ useApps: () => ({ isAppEnabled: () => false }) }))

// The hook that fires GET /matches?customer_id= is proven separately
// (useCustomerMatches.test.ts, request-shape) — this file stubs it so the
// component test stays about rendering, not the network seam.
const mockUseCustomerMatches = vi.fn()
vi.mock('../hooks/useCustomerDrawerData', () => ({ useCustomerMatches: () => mockUseCustomerMatches() }))

// Point 1: MatchModal itself is the most-watched screen in the app and has its
// own exhaustive test file — stubbed here so this test only proves the TRIGGER
// wires the right initial props, not the modal's internals.
const matchModalProps = vi.fn()
vi.mock('@/pages/candidates/drawer/MatchModal', () => ({
  default: (props: Record<string, unknown>) => { matchModalProps(props); return <div data-testid="match-modal" /> },
}))

const row = (over: Partial<CustomerMatchRow> = {}): CustomerMatchRow => ({
  id: 'm-1', referenceNumber: 'M-1', candidate: 'Jane Doe', initials: 'JD',
  vacancy: 'Verpleegkundige', client: 'Yesway', candidateId: 'cand-1', vacancyId: 'vac-1', clientId: 'cust-1',
  score: 82, stage: '', status: '', stageColor: '', owner: '', ownerId: null, ownerInitials: '', ownerColor: null,
  date: '', approval_status: '', approval_rejected_reason: '', customFieldValues: {},
  helloflexLink: null, shiftmanagerLink: null, archived: false, archivedAt: null,
  contractType: null, contractStatus: null,
  ...over,
})

const ct = (key: string) => i18n.t(key, { ns: 'candidates' })
const cust = (key: string) => i18n.t(key, { ns: 'customers' })

describe('CustomerDrawer · MatchesTab', () => {
  it('shows loading, then the empty state with no matches', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: true, error: false, reload: vi.fn() })
    const { rerender } = render(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText(i18n.t('page.loading', { ns: 'customers' }))).toBeInTheDocument()

    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: false, error: false, reload: vi.fn() })
    rerender(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText(ct('matchesView.empty'))).toBeInTheDocument()
  })

  it('shows the error state on a failed fetch', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: false, error: true, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText(i18n.t('matches.loadError', { ns: 'customers' }))).toBeInTheDocument()
  })

  it('renders the candidate (swapped from the candidate card\'s "Client" row), vacancy, contract form and contract status', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row({ contractType: 'Fase 1-2 z.u.b.', contractStatus: 'active' })], loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Fase 1-2 z.u.b.')).toBeInTheDocument()
    expect(screen.getByText(ct('matchesView.contractStatus.active'))).toBeInTheDocument()
  })

  // Point 2: the fase merges into the title now — no separate row, and the
  // stage's own colour rides the title's second half.
  it('resolves the fase from useMatchStatuses INTO THE TITLE — the slug wins over the raw stage label', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    mockUseCustomerMatches.mockReturnValue({ rows: [row({ status: 'open', stage: 'Fallback stage', stageColor: '#999999' })], loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)
    expect(metaOf).toHaveBeenCalledWith('open')
    expect(screen.getByText('Open (lookup)')).toBeInTheDocument()
    expect(screen.queryByText('Fallback stage')).toBeNull()
  })

  it('renders "Open match" as a real new-tab anchor, never an in-app-only button', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row()], loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)
    const openLink = screen.getByTitle(ct('matchesView.openMatch'))
    expect(openLink.tagName).toBe('A')
    expect(openLink.getAttribute('href')).toContain('?open=m-1')
    expect(openLink.getAttribute('target')).toBe('_blank')
    expect(openLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  // Read-only per §3B: a match's fields are opened/edited in its own drawer,
  // never here — the card itself never gets an onEdit, so no pencil renders.
  it('never renders a pencil/edit control on the card', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row()], loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)
    expect(screen.queryByTitle(i18n.t('common:edit'))).toBeNull()
  })
})

/** Point 1 (Danny's ten-point round): "+ Match" opens MatchModal already
 *  scoped to this customer — a PREFILL (initialCustomerId), never a lock. */
describe('MatchesTab · "+ Match" (point 1)', () => {
  it('renders the add trigger and opens MatchModal with this customer prefilled on click', async () => {
    const user = userEvent.setup()
    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-42" />)
    expect(screen.queryByTestId('match-modal')).toBeNull()

    await user.click(screen.getByRole('button', { name: cust('matches.add') }))
    expect(screen.getByTestId('match-modal')).toBeInTheDocument()
    expect(matchModalProps).toHaveBeenCalledWith(expect.objectContaining({ initialCustomerId: 'cust-42' }))
    // No candidate/location/department lock — only the customer is prefilled.
    expect(matchModalProps).not.toHaveBeenCalledWith(expect.objectContaining({ candidateId: expect.anything() }))
  })

  it('refetches the list once the modal reports a created match', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: false, error: false, reload })
    render(<MatchesTab customerId="cust-42" />)
    await user.click(screen.getByRole('button', { name: cust('matches.add') }))
    const { onCreated } = matchModalProps.mock.calls.at(-1)?.[0] as { onCreated: () => void }
    onCreated()
    expect(reload).toHaveBeenCalled()
  })
})

/** Toolbar (Danny 03-08: "bij Matches wil ik ook een zoekbalk en statussen
 *  hebben") — search (vacancy title + candidate name) and the shared
 *  StatusFilterSelect keyed on the match status vocabulary. */
describe('MatchesTab · toolbar search + status filter', () => {
  const rows: CustomerMatchRow[] = [
    row({ id: 'm-1', vacancy: 'Verpleegkundige', candidate: 'Jane Doe', status: 'pending' }),
    row({ id: 'm-2', vacancy: 'Verzorgende IG', candidate: 'John Roe', status: 'confirmed' }),
  ]

  it('shows every match until a status is picked (nothing selected = all)', () => {
    mockUseCustomerMatches.mockReturnValue({ rows, loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('John Roe')).toBeInTheDocument()
  })

  it('search narrows on vacancy title + candidate name', async () => {
    const user = userEvent.setup()
    mockUseCustomerMatches.mockReturnValue({ rows, loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)
    await user.type(screen.getByRole('textbox'), 'jane')
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText('John Roe')).toBeNull()
  })

  it('the status filter narrows to the picked status only', async () => {
    const user = userEvent.setup()
    mockUseCustomerMatches.mockReturnValue({ rows, loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)
    // Real i18n is loaded in this file (see the side-effect import above). The
    // StatusFilterSelect trigger shows the pill+count convention since
    // HUISSTIJL-1 batch G — it always reads the static "Status" word, never
    // the picked value, so this asserts the REAL translated "Status" copy.
    await user.click(screen.getByRole('button', { name: i18n.t('filters.status', { ns: 'customers' }) }))
    await user.click(await screen.findByRole('button', { name: 'Bevestigd' }))
    expect(screen.getByText('John Roe')).toBeInTheDocument()
    expect(screen.queryByText('Jane Doe')).toBeNull()
  })

  // TOOLBAR-ORDER-1 (Danny, live 04-08: "Nieuwe Match is rechts!!! en status in
  // het midden") — the house order is search -> status filter -> "+ Match",
  // never the add button before the filter. Asserted via DOM position, not just
  // presence, since the earlier layout had all three elements present too.
  it('renders the toolbar in house order: search, then status filter, then "+ Match"', () => {
    mockUseCustomerMatches.mockReturnValue({ rows, loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)
    const searchInput = screen.getByRole('textbox')
    const statusTrigger = screen.getByTitle(i18n.t('filters.statusFilter', { ns: 'customers' }))
    const addButton = screen.getByRole('button', { name: cust('matches.add') })
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING
    expect(Boolean(searchInput.compareDocumentPosition(statusTrigger) & FOLLOWING)).toBe(true)
    expect(Boolean(statusTrigger.compareDocumentPosition(addButton) & FOLLOWING)).toBe(true)
  })
})

/** Double open-icon fix (Danny, seeing a Verzorgende IG / EVV card: "Waarom heb
 *  ik op de regel twee keer een icoon met open-in-nieuw-venster?"). The vacancy
 *  title's own EntityLink icon is now suppressed (hideIcon) — the explicit "Open
 *  match" ⧉ stays the ONE open-in-new icon in the card header. */
describe('MatchesTab · exactly one open-in-new icon per card header', () => {
  it('renders a single ExternalLink glyph in the HEADER row, not two', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row({ vacancy: 'Verzorgende IG / EVV' })], loading: false, error: false, reload: vi.fn() })
    render(<MatchesTab customerId="cust-1" />)
    // Scoped to the header row itself — the SEPARATE "Candidate" field row below
    // legitimately carries its own EntityLink icon and must not be counted here.
    const header = screen.getByTitle(ct('matchesView.openMatch')).parentElement as HTMLElement
    expect(header.querySelectorAll('svg.lucide-external-link')).toHaveLength(1)
  })
})
