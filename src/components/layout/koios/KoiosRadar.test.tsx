import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders only the non-zero signals, most-urgent first, excluding missing_appointment', async () => {
    heavyGetMock.mockResolvedValue(statsResponse({
      stale_6m: 0, never_contacted: 5, no_followup_planned: 0,
      intake_planned: 2, active_conversations: 1, tasks: 3,
      missing_appointment: 9, // v1 scope: no candidate-list filter yet — must never render
    }))
    render(<KoiosRadar />)
    const buttons = await screen.findAllByRole('button')
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
