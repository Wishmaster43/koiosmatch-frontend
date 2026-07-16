import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MatchesTab from './MatchesTab'
import type { Candidate } from '@/types/candidate'

// Spy on the cross-entity navigation (candidate → Match) instead of a real page switch.
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

// The lookup's own fetch/resolution is out of scope — a controlled meta resolver
// lets the test assert the card prefers it over the raw backend-resolved stage.
const metaOf = vi.fn((v?: string) => (v === 'open' ? { value: 'open', label: 'Open (lookup)', color: '#123456', is_closed: false } : undefined))
vi.mock('@/lib/useMatchStatuses', () => ({ useMatchStatuses: () => ({ statuses: [], metaOf }) }))

// vi.mock factories are hoisted above top-level const declarations, so a plain
// `const rememberReturnTab = vi.fn()` referenced directly INSIDE the factory
// (not inside a nested closure) throws a TDZ error — vi.hoisted() sidesteps that.
const { rememberReturnTab } = vi.hoisted(() => ({ rememberReturnTab: vi.fn() }))
vi.mock('./constants', () => ({ rememberReturnTab }))

const candidate = (matches: unknown[]): Candidate => ({ id: 42, matches } as unknown as Candidate)

describe('MatchesTab', () => {
  it('shows the empty state with no matches', () => {
    render(<MatchesTab c={candidate([])} />)
    expect(screen.getByText('matchesView.empty')).toBeInTheDocument()
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

  it('resolves Fase from useMatchStatuses — the slug wins over the raw backend-resolved stage label', () => {
    render(<MatchesTab c={candidate([
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', status: 'open', stage: 'Fallback stage', stageColor: '#999999' },
    ])} />)
    expect(metaOf).toHaveBeenCalledWith('open')
    expect(screen.getByText('Open (lookup)')).toBeInTheDocument()
    expect(screen.queryByText('Fallback stage')).toBeNull()
  })

  it('falls back to the raw stage label when the status slug has no lookup match', () => {
    render(<MatchesTab c={candidate([
      { id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway', status: 'unknown-slug', stage: 'Fallback stage', stageColor: '#999999' },
    ])} />)
    expect(screen.getByText('Fallback stage')).toBeInTheDocument()
  })

  it('stashes the active tab before cross-navigating to the linked match (NAV-BACK-1)', async () => {
    const user = userEvent.setup()
    render(<MatchesTab c={candidate([{ id: 'm1', vacancyTitle: 'Verpleegkundige', client: 'Yesway' }])} />)
    await user.click(screen.getByTitle('matchesView.openMatch'))
    expect(rememberReturnTab).toHaveBeenCalledWith(42, 'work')
    expect(openEntity).toHaveBeenCalledWith('matches', 'm1')
  })
})
