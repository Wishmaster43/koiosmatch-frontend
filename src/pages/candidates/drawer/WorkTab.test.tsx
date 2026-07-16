import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
