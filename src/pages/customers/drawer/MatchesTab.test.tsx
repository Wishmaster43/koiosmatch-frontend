/**
 * MatchesTab (customer drawer) — mirrors candidates/drawer/MatchesTab.test.tsx's
 * own coverage: empty state, the real-anchor "Open match" affordance, and the
 * four explicit UI states (§3). The one behavioural difference from the
 * candidate tab is proven here too: this tab is READ-ONLY — no pencil/onEdit,
 * ever (a match is opened/edited in its own drawer, never from this list).
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
// STATUSES (this task, MATCHES-TOOLBAR-1): a real (non-empty) list so the new
// StatusFilterSelect toolbar has real options to filter/pick from.
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

// The hook that fires GET /matches?customer_id= is proven separately
// (useCustomerMatches.test.ts, request-shape) — this file stubs it so the
// component test stays about rendering, not the network seam.
const mockUseCustomerMatches = vi.fn()
vi.mock('../hooks/useCustomerDrawerData', () => ({ useCustomerMatches: () => mockUseCustomerMatches() }))

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

describe('CustomerDrawer · MatchesTab', () => {
  it('shows loading, then the empty state with no matches', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: true, error: false })
    const { rerender } = render(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText(i18n.t('page.loading', { ns: 'customers' }))).toBeInTheDocument()

    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: false, error: false })
    rerender(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText(ct('matchesView.empty'))).toBeInTheDocument()
  })

  it('shows the error state on a failed fetch', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [], loading: false, error: true })
    render(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText(i18n.t('matches.loadError', { ns: 'customers' }))).toBeInTheDocument()
  })

  it('renders the candidate (swapped from the candidate card\'s "Client" row), vacancy, contract form and contract status', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row({ contractType: 'Fase 1-2 z.u.b.', contractStatus: 'active' })], loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Verpleegkundige')).toBeInTheDocument()
    expect(screen.getByText('Fase 1-2 z.u.b.')).toBeInTheDocument()
    expect(screen.getByText(ct('matchesView.contractStatus.active'))).toBeInTheDocument()
  })

  it('resolves the stage from useMatchStatuses — the slug wins over the raw stage label', () => {
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    mockUseCustomerMatches.mockReturnValue({ rows: [row({ status: 'open', stage: 'Fallback stage', stageColor: '#999999' })], loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    expect(metaOf).toHaveBeenCalledWith('open')
    expect(screen.getByText('Open (lookup)')).toBeInTheDocument()
    expect(screen.queryByText('Fallback stage')).toBeNull()
  })

  it('renders "Open match" as a real new-tab anchor, never an in-app-only button', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row()], loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    const openLink = screen.getByTitle(ct('matchesView.openMatch'))
    expect(openLink.tagName).toBe('A')
    expect(openLink.getAttribute('href')).toContain('?open=m-1')
    expect(openLink.getAttribute('target')).toBe('_blank')
    expect(openLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  // Read-only per §3B: a match is opened/edited in its own drawer, never here —
  // unlike the candidate's own MatchesTab, this component never accepts an onEdit
  // prop at all, so no pencil/edit control can ever render.
  it('never renders a pencil/edit control — this tab has no onEdit prop at all', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row()], loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    expect(screen.queryByRole('button', { name: 'common:edit' })).toBeNull()
    expect(screen.queryByTitle(i18n.t('common:edit'))).toBeNull()
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
    mockUseCustomerMatches.mockReturnValue({ rows, loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('John Roe')).toBeInTheDocument()
  })

  it('search narrows on vacancy title + candidate name', async () => {
    const user = userEvent.setup()
    mockUseCustomerMatches.mockReturnValue({ rows, loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    await user.type(screen.getByRole('textbox'), 'jane')
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText('John Roe')).toBeNull()
  })

  it('the status filter narrows to the picked status only', async () => {
    const user = userEvent.setup()
    mockUseCustomerMatches.mockReturnValue({ rows, loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    // Real i18n is loaded in this file (see the side-effect import above), so the
    // trigger's own text is the REAL translated "all statuses" copy, not the raw key.
    await user.click(screen.getByRole('button', { name: i18n.t('filters.allStatuses', { ns: 'customers' }) }))
    await user.click(await screen.findByRole('button', { name: 'Bevestigd' }))
    expect(screen.getByText('John Roe')).toBeInTheDocument()
    expect(screen.queryByText('Jane Doe')).toBeNull()
  })
})

/** Double open-icon fix (Danny, seeing a Verzorgende IG / EVV card: "Waarom heb
 *  ik op de regel twee keer een icoon met open-in-nieuw-venster?"). The vacancy
 *  title's own EntityLink icon is now suppressed (hideIcon) — the explicit "Open
 *  match" ⧉ stays the ONE open-in-new icon in the card header. */
describe('MatchesTab · exactly one open-in-new icon per card header', () => {
  it('renders a single ExternalLink glyph in the HEADER row, not two', () => {
    mockUseCustomerMatches.mockReturnValue({ rows: [row({ vacancy: 'Verzorgende IG / EVV' })], loading: false, error: false })
    render(<MatchesTab customerId="cust-1" />)
    // Scoped to the header row itself — the SEPARATE "Candidate" field row below
    // legitimately carries its own EntityLink icon and must not be counted here.
    const header = screen.getByTitle(ct('matchesView.openMatch')).parentElement as HTMLElement
    expect(header.querySelectorAll('svg.lucide-external-link')).toHaveLength(1)
  })
})
