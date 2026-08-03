/**
 * MatchesTab (candidate drawer) — mirrors customers/drawer/MatchesTab.test.tsx's
 * own coverage now that both share the `MatchCard` body (Danny's ten-point
 * round). Real i18n is loaded (side-effect import): MatchCard uses
 * `useDateFormat` (lib/datetime), which itself imports `@/i18n` for its locale
 * map, so a raw-key stub would assert against text that never actually renders
 * — real copy is the only assertion that can't quietly rot.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import MatchesTab from './MatchesTab'
import type { Candidate } from '@/types/candidate'

const ct = (key: string) => i18n.t(key, { ns: 'candidates' })
const cm = (key: string) => i18n.t(key, { ns: 'common' })

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

  it('renders Klant + Contractvorm rows, dash when Contractvorm is absent', () => {
    render(<MatchesTab c={candidate([
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', contractType: null, contractStatus: 'active' },
    ])} />)
    expect(screen.getByText('Yesway')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('renders the Contractvorm value when present', () => {
    render(<MatchesTab c={candidate([
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', contractType: 'Fase 1-2 z.u.b. (Works)' },
    ])} />)
    expect(screen.getByText('Fase 1-2 z.u.b. (Works)')).toBeInTheDocument()
  })

  // Point 2: the fase merges into the title now — no separate row, and the
  // stage's own colour rides the title's second half.
  it('resolves the fase from useMatchStatuses INTO THE TITLE — the slug wins over the raw stage label', () => {
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
    await user.click(screen.getByRole('button', { name: i18n.t('filters.allStatuses', { ns: 'customers' }) }))
    await user.click(await screen.findByRole('button', { name: 'Bevestigd' }))
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.queryByText('Yesway')).toBeNull()
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
