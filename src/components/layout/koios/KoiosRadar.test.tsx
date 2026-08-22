import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosRadar from './KoiosRadar'

// heavyGet is the shared guarded-GET wrapper (dedup + cooldown); the hook only
// cares about the resolved axios-shaped response, so a bare mock is enough.
const heavyGetMock = vi.fn()
vi.mock('@/lib/heavyGet', () => ({ heavyGet: (...args: unknown[]) => heavyGetMock(...args) }))

// Wire shape mirrors the Laravel API-resource double-wrap ({ data: { data: … } })
// unwrap() already handles elsewhere in the app.
const statsResponse = (attention: Record<string, number>) => ({ data: { data: { attention } } })

describe('KoiosRadar', () => {
  it('shows a loading notice before the stats fetch resolves', () => {
    heavyGetMock.mockReturnValue(new Promise(() => {})) // never resolves within this test
    render(<KoiosRadar />)
    expect(screen.getByText('common:loading')).toBeInTheDocument()
  })

  it('shows a calm error notice when the stats fetch fails', async () => {
    heavyGetMock.mockRejectedValue(new Error('network'))
    render(<KoiosRadar />)
    expect(await screen.findByText('common:error.body')).toBeInTheDocument()
  })

  it('shows the calm empty-state line when every signal is zero', async () => {
    heavyGetMock.mockResolvedValue(statsResponse({
      stale_6m: 0, never_contacted: 0, no_followup_planned: 0,
      intake_planned: 0, active_conversations: 0, tasks: 0,
    }))
    render(<KoiosRadar />)
    expect(await screen.findByText('common:koios.radar.empty')).toBeInTheDocument()
    // No signal-row buttons — only the card's own collapse/expand toggle remains
    // (it carries no aria-label, unlike every signal row).
    const buttons = screen.queryAllByRole('button')
    expect(buttons.filter(b => b.hasAttribute('aria-label'))).toHaveLength(0)
    expect(buttons).toHaveLength(1)
  })

  it('renders only the non-zero signals, most-urgent first, excluding missing_appointment', async () => {
    heavyGetMock.mockResolvedValue(statsResponse({
      stale_6m: 0, never_contacted: 5, no_followup_planned: 0,
      intake_planned: 2, active_conversations: 1, tasks: 3,
      missing_appointment: 9, // v1 scope: no candidate-list filter yet — must never render
    }))
    render(<KoiosRadar />)
    // The toggle button renders synchronously (before the stats fetch resolves),
    // so wait for a specific ROW first — findAllByRole would otherwise resolve
    // immediately with just the toggle and never retry.
    await screen.findByRole('button', { name: 'candidates:kpi.tasks: 3' })
    // Drop the card's own collapse/expand toggle (no aria-label) before comparing rows.
    const buttons = screen.getAllByRole('button').filter(b => b.hasAttribute('aria-label'))
    // Priority order: intake → stale → neverContacted → noFollowup → activeConv → tasks;
    // zero-count and stale/noFollowup are dropped here, missing_appointment has no row at all.
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual([
      'candidates:kpi.intake: 2',
      'candidates:analytics.neverContacted: 5',
      'candidates:analytics.conversations: 1',
      'candidates:kpi.tasks: 3',
    ])
  })

  it('calls onNavigate with the matching attention filter id when a row is clicked', async () => {
    const user = userEvent.setup()
    heavyGetMock.mockResolvedValue(statsResponse({ never_contacted: 5 }))
    const onNavigate = vi.fn()
    render(<KoiosRadar onNavigate={onNavigate} />)
    const row = await screen.findByRole('button', { name: 'candidates:analytics.neverContacted: 5' })
    await user.click(row)
    expect(onNavigate).toHaveBeenCalledWith('candidates', { attention: 'neverContacted' })
  })

  it('never throws when onNavigate is not provided', async () => {
    const user = userEvent.setup()
    heavyGetMock.mockResolvedValue(statsResponse({ tasks: 1 }))
    render(<KoiosRadar />)
    const row = await screen.findByRole('button', { name: 'candidates:kpi.tasks: 1' })
    await user.click(row)
    await waitFor(() => expect(row).toBeInTheDocument())
  })
})

// COLLAPSE-1 (Danny 22-08: "nu te veel ruimte in beslag" — closable + re-summonable).
describe('KoiosRadar — collapse', () => {
  beforeEach(() => localStorage.clear())

  it('is open by default — rows render and the toggle reports aria-expanded=true', async () => {
    heavyGetMock.mockResolvedValue(statsResponse({ never_contacted: 5 }))
    render(<KoiosRadar />)
    await screen.findByRole('button', { name: 'candidates:analytics.neverContacted: 5' })
    expect(screen.getByRole('button', { name: 'common:koios.radar.title' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('collapsing hides the rows and flips aria-expanded; expanding restores them', async () => {
    const user = userEvent.setup()
    heavyGetMock.mockResolvedValue(statsResponse({ never_contacted: 5 }))
    render(<KoiosRadar />)
    await screen.findByRole('button', { name: 'candidates:analytics.neverContacted: 5' })
    const toggle = screen.getByRole('button', { name: 'common:koios.radar.title' })

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'candidates:analytics.neverContacted: 5' })).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByRole('button', { name: 'candidates:analytics.neverContacted: 5' })).toBeInTheDocument()
  })

  it('persists the collapsed choice across a remount (mocked seam: localStorage)', async () => {
    const user = userEvent.setup()
    heavyGetMock.mockResolvedValue(statsResponse({ never_contacted: 5 }))
    const { unmount } = render(<KoiosRadar />)
    await screen.findByRole('button', { name: 'candidates:analytics.neverContacted: 5' })
    await user.click(screen.getByRole('button', { name: 'common:koios.radar.title' }))
    // Assert the WRITE, not just that the callback fired (§13).
    expect(localStorage.getItem('koios.radar.collapsed')).toBe('true')
    unmount()

    render(<KoiosRadar />)
    // The restored render reads the persisted flag synchronously — no need to
    // wait for the (independent) stats fetch to resolve first. Still flush that
    // fetch's own microtask inside act() so it never resolves after the test ends.
    await act(async () => { await Promise.resolve() })
    expect(screen.getByRole('button', { name: 'common:koios.radar.title' })).toHaveAttribute('aria-expanded', 'false')
  })
})
