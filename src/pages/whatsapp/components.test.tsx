/**
 * WhatsApp dashboard components — tests for EscalationList, WindowCountdownChip
 * and AgentBadgeChip (X-28). LOOKUP-GAP-1(c) regression tests for
 * EscalationList's reason colour/label resolution. useEscalationReasons is
 * mocked (its own contract is covered by ./hooks/useEscalationReasons.test.ts)
 * so this file stays focused on EscalationList's rendering behaviour: the row's
 * own `escalation_reason` (bundle F, CMBE 685ce339) wins first, a real tenant
 * reason (unknown to the OLD hardcoded map) renders from the id-based lookup
 * next, and the backend-derived diagnostic keys still render their existing
 * colour-coded fallback for a row with neither (no regression — see
 * components.tsx's DERIVED_REASON_STYLE header comment for why that fallback
 * still exists).
 *
 * The badge itself is the shared SoftChip (§4) — its rendered TEXT colour is
 * `chipInk(color)` (blended 45% toward --text, WCAG AA on the tint), never the
 * raw resolved colour; the assertions below match that, not the input colour.
 *
 * WindowCountdownChip tests verify the chip states: no inbound = nothing,
 * open within 24h = countdown, open under 2h = warning tint countdown,
 * closed after inbound = "Venster gesloten" muted chip (X-28).
 * AgentBadgeChip tests verify status rendering: active = info chip with icon,
 * paused = muted chip, null = nothing.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EscalationList, WindowCountdownChip, AgentBadgeChip } from './components'
import { chipInk, tintBg } from '@/lib/tint'
import type { WaEscalation } from '@/types/whatsapp'
import type { WaConversationRow } from './hooks/useConversations'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const mockMetaOf = vi.fn()
vi.mock('./hooks/useEscalationReasons', () => ({ useEscalationReasons: () => ({ metaOf: mockMetaOf, reasons: [], loading: false }) }))

const candidate = { first_name: 'Jan', last_name: 'Jansen' }

describe('EscalationList · reason colour/label (LOOKUP-GAP-1c)', () => {
  it('the row\'s own escalation_reason (bundle F) wins over both the lookup and the derived key, rendered as-is', () => {
    // The lookup must not even be needed for this row — proves the real payload
    // field is read directly, not resolved through metaOf(). Uses a design-token
    // colour (not a raw hex) so this fixture needs no huisstijl disable — the
    // colour-resolution path under test is identical either way.
    mockMetaOf.mockReturnValue(undefined)
    const escalations: WaEscalation[] = [{
      candidate_id: 'c1', candidate,
      // A derived key that must NOT end up as the rendered label.
      reason: 'no_reply',
      escalation_reason_id: 'er-9',
      escalation_reason: { id: 'er-9', name: 'Klant boos', color: 'var(--color-info)' },
      hours_waiting: 2,
    }]
    render(<EscalationList escalations={escalations} />)
    expect(screen.getByText('Klant boos')).toHaveStyle({ color: chipInk('var(--color-info)') })
    expect(screen.queryByText('reasons.no_reply')).not.toBeInTheDocument()
  })

  it('a tenant reason unknown to the old hardcoded map renders its OWN label/colour from the lookup', () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA: an arbitrary tenant lookup colour fixture, not an invented UI colour
    mockMetaOf.mockImplementation((v?: string | null) => v === 'klacht-id' ? { value: 'klacht-id', label: 'Klacht', color: '#00aaff' } : undefined)
    const escalations: WaEscalation[] = [{ candidate_id: 'c1', candidate, reason: 'klacht-id', hours_waiting: 3 }]
    render(<EscalationList escalations={escalations} />)
    const badge = screen.getByText('Klacht')
    expect(badge).toBeInTheDocument()
    // eslint-disable-next-line no-restricted-syntax -- DATA: asserting the exact colour-mix output for the fixture colour above
    expect(badge).toHaveStyle({ color: chipInk('#00aaff'), background: tintBg('#00aaff') })
  })

  it('a lookup match wins even when the value ALSO happens to collide with a derived diagnostic key', () => {
    // Proves resolution goes lookup-first, not "literal map first" — a tenant could
    // in principle name/id a reason the same as a derived key; the real lookup still wins.
    // eslint-disable-next-line no-restricted-syntax -- DATA: an arbitrary tenant lookup colour fixture, not an invented UI colour
    mockMetaOf.mockImplementation((v?: string | null) => v === 'no_reply' ? { value: 'no_reply', label: 'Geen actie ondernomen', color: '#556677' } : undefined)
    const escalations: WaEscalation[] = [{ candidate_id: 'c1', candidate, reason: 'no_reply', hours_waiting: 5 }]
    render(<EscalationList escalations={escalations} />)
    // eslint-disable-next-line no-restricted-syntax -- DATA: asserting against the fixture colour above
    expect(screen.getByText('Geen actie ondernomen')).toHaveStyle({ color: chipInk('#556677') })
    expect(screen.queryByText('reasons.no_reply')).not.toBeInTheDocument()
  })

  it('keeps the three backend-derived diagnostic keys colour-coded when the lookup has no match (no regression)', () => {
    mockMetaOf.mockReturnValue(undefined)
    const escalations: WaEscalation[] = [
      { candidate_id: 'c1', candidate, reason: 'failed_delivery', hours_waiting: 1 },
      { candidate_id: 'c2', candidate, reason: 'no_reply', hours_waiting: 2 },
      { candidate_id: 'c3', candidate, reason: 'negative_response', hours_waiting: 4 },
    ]
    render(<EscalationList escalations={escalations} />)
    expect(screen.getByText('reasons.failed_delivery')).toHaveStyle({ color: chipInk('var(--color-danger)') })
    expect(screen.getByText('reasons.no_reply')).toHaveStyle({ color: chipInk('var(--color-warning)') })
    expect(screen.getByText('reasons.negative_response')).toHaveStyle({ color: chipInk('var(--color-violet)') })
  })

  it('an entirely unknown reason (no lookup match, not a derived key) falls to the neutral muted colour', () => {
    mockMetaOf.mockReturnValue(undefined)
    const escalations: WaEscalation[] = [{ candidate_id: 'c1', candidate, reason: 'mystery', hours_waiting: 2 }]
    render(<EscalationList escalations={escalations} />)
    expect(screen.getByText('reasons.mystery')).toHaveStyle({ color: chipInk('var(--text-muted)') })
  })
})

describe('WindowCountdownChip · X-28 24h window visibility', () => {
  const row = (over: Partial<WaConversationRow> = {}): WaConversationRow => ({
    id: 'conv-1', candidate_id: 'c1', wa_number: '+31612345678',
    primary_channel: 'wa_web', ...over,
  })

  it('renders nothing when no inbound message ever arrived (no window)', () => {
    render(<WindowCountdownChip row={row({ last_inbound_at: null, window_open: false })} />)
    expect(screen.queryByText(/conversations\./)).not.toBeInTheDocument()
  })

  it('shows countdown when window is open and more than 2 hours remain (primary tint)', () => {
    // Window expires 3h from now.
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
    const inboundAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    render(<WindowCountdownChip row={row({
      last_inbound_at: inboundAt,
      window_expires_at: expiresAt,
      window_open: true,
    })} />)
    expect(screen.getByText(/conversations\.windowClosesIn/)).toBeInTheDocument()
  })

  it('shows countdown when window is open and less than 2 hours remain (warning tint)', () => {
    // Window expires 1h 30m from now.
    const expiresAt = new Date(Date.now() + 90 * 60 * 1000).toISOString()
    const inboundAt = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    render(<WindowCountdownChip row={row({
      last_inbound_at: inboundAt,
      window_expires_at: expiresAt,
      window_open: true,
    })} />)
    const chip = screen.getByText(/conversations\.windowClosesIn/)
    expect(chip).toBeInTheDocument()
  })

  it('shows "Venster gesloten" muted chip when window is closed but an inbound arrived', () => {
    const inboundAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    render(<WindowCountdownChip row={row({
      last_inbound_at: inboundAt,
      window_expires_at: inboundAt,
      window_open: false,
    })} />)
    expect(screen.getByText('conversations.windowClosed')).toBeInTheDocument()
  })
})

describe('AgentBadgeChip · X-28 agent session status', () => {
  it('renders nothing when agent_session_status is null', () => {
    render(<AgentBadgeChip agentSessionStatus={null} />)
    expect(screen.queryByText('conversations.agentActive')).not.toBeInTheDocument()
    expect(screen.queryByText('conversations.agentPaused')).not.toBeInTheDocument()
  })

  it('shows "AI-agent actief" info chip when agent_session_status is active', () => {
    render(<AgentBadgeChip agentSessionStatus="active" />)
    expect(screen.getByText('conversations.agentActive')).toBeInTheDocument()
  })

  it('shows "Recruiter neemt over" muted chip when agent_session_status is paused', () => {
    render(<AgentBadgeChip agentSessionStatus="paused" />)
    expect(screen.getByText('conversations.agentPaused')).toBeInTheDocument()
  })
})
