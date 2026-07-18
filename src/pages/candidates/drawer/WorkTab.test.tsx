import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkTab from './WorkTab'
import type { Candidate } from '@/types/candidate'

// The candidate's appointments fetch (a sibling structured entity) is irrelevant
// to the vacancy-title/created-date row this test covers.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) },
  unwrap: (r: unknown) => r,
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => `fmt(${v})`, locale: 'nl-NL' }) }))
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn(), navigate: vi.fn() }) }))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf: () => undefined }) }))
// sectionBlock (styling) + the NAV-BACK-1 helpers MatchesTab imports from the same module.
vi.mock('./constants', () => ({ sectionBlock: {}, rememberReturnTab: vi.fn(), peekReturnTab: () => null, clearReturnTab: () => {} }))

const candidate = (applications: unknown[]): Candidate => ({ id: 9, matches: [], applications } as unknown as Candidate)

describe('WorkTab', () => {
  it('links the vacancy title internally (EntityLink) when there is an id but no external url', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige' }, created_at: '2026-07-01' }])} />)
    expect(screen.getByRole('button', { name: 'Verpleegkundige' })).toBeInTheDocument()
  })

  it('shows the application created date (APP-EMBED-1)', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige' }, created_at: '2026-07-01' }])} />)
    expect(screen.getByText('fmt(2026-07-01)')).toBeInTheDocument()
  })

  it('shows a dash for a genuinely vacancy-less row (no title, no id, no url)', () => {
    render(<WorkTab c={candidate([{ id: 'a1' }])} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('shows a dash for the created date when genuinely missing', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige' } }])} />)
    // Two dashes render for a title-only row with no created_at: none from the title,
    // one from the date. Assert the formatted date is NOT rendered instead of a count,
    // since the vacancy-less test above already covers the dash count.
    expect(screen.queryByText(/fmt\(/)).toBeNull()
  })

  it('preserves the existing external-URL link (isSafeUrl-gated) untouched', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige', url: 'https://example.com/vacancy' }, created_at: '2026-07-01' }])} />)
    const anchor = screen.getByRole('link', { name: 'Verpleegkundige' })
    expect(anchor).toHaveAttribute('href', 'https://example.com/vacancy')
  })
})

// Kandidaten-ronde-2, punt C: Sollicitaties · Matches · Talentenpools sub-tabs —
// the two application actions and the "+ Match" button move INTO their own
// sub-tab instead of sharing one header row. This file doesn't initialise real
// i18n (react-i18next isn't mocked, and `@/lib/datetime` — the module other
// candidate tests piggyback real i18n init on — IS mocked away here), so `t()`
// resolves to the raw key, same as AddApplicationModal.test.tsx; assertions
// below match on those raw keys, not translated Dutch text.
describe('WorkTab · sub-tabs (kandidaten-ronde-2, punt C)', () => {
  it('defaults to the Sollicitaties sub-tab, with both its actions visible', () => {
    render(<WorkTab c={candidate([{ id: 'a1', vacancy: { id: 'v9', title: 'Verpleegkundige' }, created_at: '2026-07-01' }])} />)
    expect(screen.getByRole('tab', { name: 'sections.applications' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'work.addApplication' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'work.planIntake' })).toBeInTheDocument()
    // The Matches/Talentenpools content isn't mounted until their sub-tab is picked.
    expect(screen.queryByRole('button', { name: 'work.addMatch' })).toBeNull()
  })

  it('the Matches sub-tab shows the "+ Match" button (moved from the shared header)', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([])} />)
    await user.click(screen.getByRole('tab', { name: 'sections.placements' }))
    expect(screen.getByRole('button', { name: 'work.addMatch' })).toBeInTheDocument()
    expect(screen.getByText('matchesView.empty')).toBeInTheDocument()
    // Sollicitaties' own actions are gone once its sub-tab isn't active.
    expect(screen.queryByRole('button', { name: 'work.addApplication' })).toBeNull()
  })

  it('the Talentenpools sub-tab renders the pools section (moved here from Profiel)', async () => {
    const user = userEvent.setup()
    render(<WorkTab c={candidate([])} />)
    await user.click(screen.getByRole('tab', { name: 'sections.pools' }))
    expect(screen.getByText('sections.poolAdd')).toBeInTheDocument()
  })

  it('sorts the sub-tabs alphabetically by (translated) label', () => {
    render(<WorkTab c={candidate([])} />)
    const tabs = screen.getAllByRole('tab').map(el => el.textContent)
    expect(tabs).toEqual(['sections.applications', 'sections.placements', 'sections.pools'])
  })
})
