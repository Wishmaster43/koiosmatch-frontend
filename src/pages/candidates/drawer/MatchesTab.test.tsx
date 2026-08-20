/**
 * MatchesTab (candidate drawer) — mirrors customers/drawer/MatchesTab.test.tsx's
 * own coverage now that both share the `MatchCard` body (Danny's ten-point
 * round). Real i18n is loaded (side-effect import): MatchCard uses
 * `useDateFormat` (lib/datetime), which itself imports `@/i18n` for its locale
 * map, so a raw-key stub would assert against text that never actually renders
 * — real copy is the only assertion that can't quietly rot.
 *
 * COMPACT ROWS (Danny live review, 04-08): this tab always renders `MatchCard`
 * with `collapsible` on, so every fixture below is now COLLAPSED by default —
 * tests that assert on DETAIL-row content (Contractvorm, dashes, …) click the
 * chevron (title = cm('expand')/cm('collapse')) first.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import MatchesTab from './MatchesTab'
import { MATCH_COL_STATUS, MATCH_COL_OTHER_PARTY, MATCH_COL_SCORE, MATCH_COL_ACTIONS } from '@/pages/matches/matchRowColumns'
import type { Candidate } from '@/types/candidate'

const ct = (key: string) => i18n.t(key, { ns: 'candidates' })
const cm = (key: string) => i18n.t(key, { ns: 'common' })
const mt = (key: string) => i18n.t(key, { ns: 'matches' })

// Spy on the cross-entity navigation (candidate → Match) instead of a real page switch.
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

// The lookup's own fetch/resolution is out of scope — a controlled meta resolver
// lets the test assert the card prefers it over the raw backend-resolved stage.
// eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
const metaOf = vi.fn((v?: string) => (v === 'open' ? { value: 'open', label: 'Open (lookup)', color: '#123456', is_closed: false } : undefined))
// MATCHES-TOOLBAR-1: a real (non-empty, neutral-slug) status list so the
// StatusFilterSelect toolbar has real options. Deliberately NOT
// 'open'/'active'/'actief' — useStatusFilter's shared guess heuristic
// (isActiveValue) would otherwise auto-propose one of those as the DEFAULT
// filter (same behaviour as Locations/Departments/Vacancies today), which would
// make a "nothing picked = all" test false.
// eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
const statuses = [
  { value: 'pending', label: 'In behandeling', color: '#123456', is_closed: false },
  { value: 'confirmed', label: 'Bevestigd', color: '#789ABC', is_closed: true },
]
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses, metaOf }) }))

// vi.mock factories are hoisted above top-level const declarations, so a plain
// `const rememberReturnTab = vi.fn()` referenced directly INSIDE the factory
// (not inside a nested closure) throws a TDZ error — vi.hoisted() sidesteps that.
const { rememberReturnTab } = vi.hoisted(() => ({ rememberReturnTab: vi.fn() }))
vi.mock('./constants', () => ({ rememberReturnTab }))

const candidate = (matches: unknown[]): Candidate => ({ id: 42, matches } as unknown as Candidate)

describe('MatchesTab', () => {
  it('shows the empty state with no matches', () => {
    render(<MatchesTab c={candidate([])} />)
    expect(screen.getByText(ct('matchesView.empty'))).toBeInTheDocument()
  })

  it('renders Klant + Contractvorm rows (after expanding the compact card), dash when Contractvorm is absent', async () => {
    const user = userEvent.setup()
    render(<MatchesTab c={candidate([
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', contractType: null, contractStatus: 'active' },
    ])} />)
    // Client is ALSO visible inline in the collapsed summary row (compact mode).
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    // The detail rows (incl. the dashes) only show once the card is expanded.
    await user.click(screen.getByTitle(cm('expand')))
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders the Contractvorm value when present (after expanding the compact card)', async () => {
    const user = userEvent.setup()
    render(<MatchesTab c={candidate([
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', contractType: 'Fase 1-2 z.u.b. (Works)' },
    ])} />)
    expect(screen.queryByText('Fase 1-2 z.u.b. (Works)')).toBeNull()
    await user.click(screen.getByTitle(cm('expand')))
    expect(screen.getByText('Fase 1-2 z.u.b. (Works)')).toBeInTheDocument()
  })

  // Point 2, since split into its own Status column (Danny 09-08 second look —
  // see the "every visible column has a header" describe block below).
  it('resolves the fase from useMatchStatuses INTO THE STATUS COLUMN — the slug wins over the raw stage label', () => {
    render(<MatchesTab c={candidate([
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', status: 'open', stage: 'Fallback stage', stageColor: '#999999' },
    ])} />)
    expect(metaOf).toHaveBeenCalledWith('open')
    expect(screen.getByText('Open (lookup)')).toBeInTheDocument()
    expect(screen.queryByText('Fallback stage')).toBeNull()
  })

  it('falls back to the raw stage label when the status slug has no lookup match', () => {
    render(<MatchesTab c={candidate([
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', status: 'unknown-slug', stage: 'Fallback stage', stageColor: '#999999' },
    ])} />)
    expect(screen.getByText('Fallback stage')).toBeInTheDocument()
  })

  // Danny 21-07: "Open match" is an explicit new-tab affordance — it must be a
  // real anchor (href + target=_blank), not an in-app-only button/openEntity call.
  it('renders "Open match" as a real new-tab anchor and stashes the return tab on click', async () => {
    const user = userEvent.setup()
    render(<MatchesTab c={candidate([{ id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway' }])} />)
    const openLink = screen.getByTitle(ct('matchesView.openMatch'))
    expect(openLink.tagName).toBe('A')
    expect(openLink.getAttribute('href')).toContain('?open=m1')
    expect(openLink.getAttribute('target')).toBe('_blank')
    expect(openLink.getAttribute('rel')).toBe('noopener noreferrer')
    await user.click(openLink)
    expect(rememberReturnTab).toHaveBeenCalledWith(42, 'work')
  })

  // Point 2 (Danny live P1): the pencil reopens the match as an edit (WorkTab owns
  // the modal state) — only rendered when the host actually wires `onEdit`.
  it('renders a pencil that reports the clicked match id via onEdit', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(<MatchesTab c={candidate([{ id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway' }])} onEdit={onEdit} />)
    await user.click(screen.getByTitle(cm('edit')))
    expect(onEdit).toHaveBeenCalledWith('m1')
  })

  it('renders no pencil when the host omits onEdit (no behaviour change)', () => {
    render(<MatchesTab c={candidate([{ id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway' }])} />)
    expect(screen.queryByTitle(cm('edit'))).toBeNull()
  })
})

/** Toolbar (Danny 03-08: one look on both the customer's and this card's Matches
 *  tab — "bij Matches wil ik ook een zoekbalk en statussen hebben"). */
describe('MatchesTab · toolbar search + status filter', () => {
  const matches = [
    { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', status: 'pending' },
    { id: 'm2', vacancyTitle: 'Verzorgende IG', client: 'Acme', status: 'confirmed' },
  ]

  it('shows every match until a status is picked (nothing selected = all)', () => {
    render(<MatchesTab c={candidate(matches)} />)
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
  })

  it('search narrows on vacancy title + client name', async () => {
    const user = userEvent.setup()
    render(<MatchesTab c={candidate(matches)} />)
    await user.type(screen.getByRole('textbox'), 'acme')
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.queryByText('Yesway')).toBeNull()
  })

  it('the status filter narrows to the picked status only', async () => {
    const user = userEvent.setup()
    render(<MatchesTab c={candidate(matches)} />)
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    await user.click(screen.getByRole('button', { name: i18n.t('filters.status', { ns: 'customers' }) }))
    await user.click(await screen.findByRole('button', { name: 'Bevestigd' }))
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.queryByText('Yesway')).toBeNull()
  })
})

/** ONE-LINE toolbar with "+ Match" (Danny live review, 04-08: "Zoeken status en
 *  + match moet op 1 lijn!!") — WorkTab used to render "+ Match" on its own row
 *  ABOVE this component; `onAdd` now renders it at the END of this SAME row. */
describe('MatchesTab · onAdd renders "+ Match" at the end of the ONE-LINE toolbar', () => {
  it('renders no "+ Match" trigger when onAdd is omitted (read-only list, unchanged)', () => {
    render(<MatchesTab c={candidate([])} />)
    expect(screen.queryByRole('button', { name: ct('work.addMatch') })).toBeNull()
  })

  it('renders "+ Match" and fires onAdd, positioned AFTER the search box and status filter (DOM order)', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<MatchesTab c={candidate([])} onAdd={onAdd} />)
    const search = screen.getByRole('textbox')
    // StatusFilterSelect shows the pill+count convention since HUISSTIJL-1 batch G:
    // the trigger always reads the static "Status" word, never the picked value.
    const statusTrigger = screen.getByRole('button', { name: i18n.t('filters.status', { ns: 'customers' }) })
    const addButton = screen.getByRole('button', { name: ct('work.addMatch') })
    expect(search.compareDocumentPosition(statusTrigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(statusTrigger.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(addButton)
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})

/** Double open-icon fix (Danny, seeing a Verzorgende IG / EVV match card: "Waarom
 *  heb ik op de regel twee keer een icoon met open-in-nieuw-venster?"). The
 *  vacancy title's own EntityLink icon is now suppressed (hideIcon) — the
 *  explicit "Open match" ⧉ stays the ONE open-in-new icon in the card header. */
describe('MatchesTab · exactly one open-in-new icon per card header', () => {
  it('renders a single ExternalLink glyph in the HEADER row, not two', () => {
    render(<MatchesTab c={candidate([{ id: 'm1', vacancyTitle: 'Verzorgende IG / EVV', client: 'Yesway' }])} />)
    // Scoped to the header row itself — a "Read-only link out to the vacancy"
    // icon can ALSO render there (when vacancyUrl is set), which is unrelated to
    // this fix and absent from this fixture (no vacancyUrl).
    const header = screen.getByTitle(ct('matchesView.openMatch')).parentElement as HTMLElement
    expect(header.querySelectorAll('svg.lucide-external-link')).toHaveLength(1)
  })
})

/** Compact rows (Danny live review, 04-08: "meer compact in een tabel weergegeven
 *  met de optie om het open te klappen") — collapsed by default to one summary
 *  row per match, expanding in place to the existing detail rows. */
describe('MatchesTab · compact collapsed/expandable rows', () => {
  it('renders ONE collapsed summary row per match — detail rows stay hidden until expanded', () => {
    render(<MatchesTab c={candidate([
      { id: 'm1', vacancyId: 'v1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', functionTitle: 'Verpleegkundige IC' },
    ])} />)
    // Summary line: vacancy title + client are both visible without expanding.
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    // The detail row's OWN value (Functietitel) stays hidden until expanded.
    expect(screen.queryByText('Verpleegkundige IC')).toBeNull()
  })

  it('expanding a match (chevron click) reveals its detail rows in place, collapsing again hides them', async () => {
    const user = userEvent.setup()
    render(<MatchesTab c={candidate([
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', functionTitle: 'Verpleegkundige IC' },
    ])} />)
    expect(screen.queryByText('Verpleegkundige IC')).toBeNull()
    await user.click(screen.getByTitle(cm('expand')))
    expect(screen.getByText('Verpleegkundige IC')).toBeInTheDocument()
    await user.click(screen.getByTitle(cm('collapse')))
    expect(screen.queryByText('Verpleegkundige IC')).toBeNull()
  })

  it("each match's expand state is independent of the others", async () => {
    const user = userEvent.setup()
    render(<MatchesTab c={candidate([
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', functionTitle: 'Functie Een' },
      { id: 'm2', vacancyTitle: 'Verzorgende IG', client: 'Acme', functionTitle: 'Functie Twee' },
    ])} />)
    await user.click(screen.getAllByTitle(cm('expand'))[0])
    expect(screen.getByText('Functie Een')).toBeInTheDocument()
    expect(screen.queryByText('Functie Twee')).toBeNull()
  })
})

/** Newest match first (Danny live review, 04-08: "gesorteerd op nieuwste match
 *  bovenaan") — CandidateMatch.createdAt (mapCandidate.ts MATCH-EMBED-1, off
 *  Candidate/MatchResource.php's own created_at) drives the sort. */
describe('MatchesTab · sorts newest match first', () => {
  it('sorts by createdAt descending regardless of the source array order', () => {
    render(<MatchesTab c={candidate([
      { id: 'm-old', vacancyId: 'v-old', vacancyTitle: 'Oudste', client: 'A', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm-new', vacancyId: 'v-new', vacancyTitle: 'Nieuwste', client: 'B', createdAt: '2026-07-01T00:00:00Z' },
      { id: 'm-mid', vacancyId: 'v-mid', vacancyTitle: 'Midden', client: 'C', createdAt: '2026-04-01T00:00:00Z' },
    ])} />)
    const titles = screen.getAllByRole('button', { name: /^(Oudste|Nieuwste|Midden)$/ }).map(el => el.textContent)
    expect(titles).toEqual(['Nieuwste', 'Midden', 'Oudste'])
  })

  it('sorts a match with no createdAt LAST, never ahead of a dated row', () => {
    render(<MatchesTab c={candidate([
      { id: 'm-dated', vacancyId: 'v-dated', vacancyTitle: 'Gedateerd', client: 'A', createdAt: '2020-01-01T00:00:00Z' },
      { id: 'm-undated', vacancyId: 'v-undated', vacancyTitle: 'Ongedateerd', client: 'B' },
    ])} />)
    const titles = screen.getAllByRole('button', { name: /^(Gedateerd|Ongedateerd)$/ }).map(el => el.textContent)
    expect(titles).toEqual(['Gedateerd', 'Ongedateerd'])
  })
})

/** Column header bar (Danny 09-08: "Match heeft geen titelbalk en sollicitaties
 *  wel") — mirrors WorkTab's own header bar so both lists read as one system;
 *  present even on the empty state, same as WorkTab's own header. */
describe('MatchesTab · column header bar (Danny 09-08)', () => {
  it('renders the Vacature/Klant header labels above the list, incl. the empty state', () => {
    render(<MatchesTab c={candidate([])} />)
    expect(screen.getByText(ct('work.vacancy'))).toBeInTheDocument()
    expect(screen.getByText(ct('matchesView.client'))).toBeInTheDocument()
    expect(screen.getByTestId('match-col-actions-header')).toBeInTheDocument()
  })

  it('renders the collapsed summary row with the FLAT surface background (matches ApplicationRow)', () => {
    render(<MatchesTab c={candidate([{ id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway' }])} />)
    expect(screen.getByTestId('match-card-header')).toHaveStyle({ background: 'var(--surface)' })
  })
})

/**
 * SECOND LOOK (Danny 09-08, "Open heeft geen kopje??"): the status pill used to
 * ride glued onto the title behind an em-dash, and the score pill sat as an
 * unlabeled dash between the client name and the icon cluster — TWO visible
 * columns with no header. This is the regression guard for exactly that
 * complaint: every visible column gets a header, and header + row cell read
 * their width from the SAME matchRowColumns.ts constants (never two loose
 * numbers, mirroring WorkTab/applicationRowColumns.ts).
 */
describe('MatchesTab · every visible column has a header (Danny 09-08 second look)', () => {
  const row = { id: 'm1', vacancyId: 'v1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', status: 'open', score: 82 }

  it('renders a Status header AND a Match(score) header, reusing WorkTab\'s own status key + MatchesTable\'s own score key', () => {
    render(<MatchesTab c={candidate([row])} />)
    // Reuses the exact key ApplicationRow's own status column header uses.
    // Scoped to the header cell's own testid: the StatusFilterSelect toolbar
    // trigger now ALSO renders the literal word "Status" (HUISSTIJL-1 batch G),
    // so an unscoped getByText('Status') matches both and throws.
    expect(screen.getByTestId('match-col-status-header')).toHaveTextContent(ct('work.colStatus'))
    // Reuses MatchesTable's own score-column label — no new i18n key introduced.
    expect(screen.getByText(mt('cols.score'))).toBeInTheDocument()
  })

  it('renders the status pill and the score pill INSIDE their own labeled columns, not glued to the title or floating unlabeled', () => {
    render(<MatchesTab c={candidate([row])} />)
    // metaOf('open') resolves to the mocked "Open (lookup)" label.
    expect(screen.getByTestId('match-col-status')).toHaveTextContent('Open (lookup)')
    expect(screen.getByTestId('match-col-score')).toHaveTextContent('82%')
    // The title itself no longer carries the merged "— {fase}" suffix.
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
  })

  it('reads every column width from the SAME matchRowColumns.ts constants for both the header cell and the row cell (never two loose numbers)', () => {
    render(<MatchesTab c={candidate([row])} />)
    // Fixed columns are pinned on width; the client column is deliberately
    // SHRINKABLE (the vacancy title must keep room), so header and cell are
    // matched on its minWidth floor instead. The point of the test is unchanged:
    // both sides read ONE constant, never two loose numbers.
    const fixed: [string, string, string][] = [
      ['match-col-status-header', 'match-col-status', `${Number(MATCH_COL_STATUS.width)}px`],
      ['match-col-score-header', 'match-col-score', `${Number(MATCH_COL_SCORE.width)}px`],
      ['match-col-actions-header', 'match-col-actions', `${Number(MATCH_COL_ACTIONS.width)}px`],
    ]
    for (const [headerId, cellId, width] of fixed) {
      expect(screen.getByTestId(headerId)).toHaveStyle({ width })
      expect(screen.getByTestId(cellId)).toHaveStyle({ width })
    }
    const clientFloor = { minWidth: `${Number(MATCH_COL_OTHER_PARTY.minWidth)}px` }
    expect(screen.getByTestId('match-col-client-header')).toHaveStyle(clientFloor)
    expect(screen.getByTestId('match-col-client')).toHaveStyle(clientFloor)
  })
})
