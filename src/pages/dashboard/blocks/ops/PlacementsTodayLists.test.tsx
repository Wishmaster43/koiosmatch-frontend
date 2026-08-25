/**
 * PlacementsTodayLists — asserts started/ended sub-lists render from the exact
 * server shape, a row click opens the match, and an empty sub-list renders
 * nothing (no fabricated zero-state).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlacementsTodayLists from './PlacementsTodayLists'
import type { PlacementsStartedEndedToday } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const feed: PlacementsStartedEndedToday = {
  started: [{ match_id: 'm1', candidate: 'Jan Jansen', customer: 'Acme' }],
  ended: [],
}

describe('PlacementsTodayLists', () => {
  it('renders the started row and hides the empty ended sub-list', () => {
    render(<PlacementsTodayLists feed={feed} onNavigate={vi.fn()} />)
    expect(screen.getByText('Jan Jansen')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    // "feed.ended" (the GroupLabel key, identity-mocked) never renders when ended is empty.
    expect(screen.queryByText('feed.ended')).not.toBeInTheDocument()
  })

  it('navigates to the match drawer on row click', () => {
    const onNavigate = vi.fn()
    render(<PlacementsTodayLists feed={feed} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Jan Jansen'))
    expect(onNavigate).toHaveBeenCalledWith('matches', { open: 'm1' })
  })

  it('falls back to customer name when candidate is absent', () => {
    render(<PlacementsTodayLists feed={{ started: [], ended: [{ match_id: 'm2', candidate: null, customer: 'Beta BV' }] }} onNavigate={vi.fn()} />)
    expect(screen.getByText('Beta BV')).toBeInTheDocument()
  })

  it('self-hides when both started and ended are empty', () => {
    const { container } = render(<PlacementsTodayLists feed={{ started: [], ended: [] }} onNavigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
