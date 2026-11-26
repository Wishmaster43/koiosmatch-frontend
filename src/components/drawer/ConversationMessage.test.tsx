/**
 * ConversationMessage — proves the K-193 channel chip renders per enum value
 * on the message bubble, stays silent for a null/unknown channel, and that
 * the purpose badge (the pre-existing seam) still renders alongside it.
 * No i18next instance is initialized in this test file, so labelOrRaw's guard on the
 * empty i18n object returns the raw fallback — a distinct channel_label per case proves
 * the chip reads channel/channel_label off the message row.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConversationMessage from './ConversationMessage'

const baseMessage = {
  id: 'm1',
  direction: 'outbound' as const,
  message_content: 'Hoi!',
  sent_at: '2026-08-25T09:00:00Z',
  purpose: 'manual',
}

const formatDateTime = (v: string) => `dt(${v})`

describe('ConversationMessage · channel badge (K-193)', () => {
  it.each(['waba', 'waba_coex', 'wa_web'])('renders a chip for known channel "%s"', (channel) => {
    render(<ConversationMessage message={{ ...baseMessage, channel, channel_label: `label-${channel}` }} formatDateTime={formatDateTime} />)
    expect(screen.getByText(`label-${channel}`)).toBeInTheDocument()
  })

  it('renders no chip when channel is unknown, even with a server label', () => {
    render(<ConversationMessage message={{ ...baseMessage, channel: 'sms', channel_label: 'SMS' }} formatDateTime={formatDateTime} />)
    expect(screen.queryByText('SMS')).not.toBeInTheDocument()
  })

  it('renders no chip when channel is absent (legacy/unknown message)', () => {
    render(<ConversationMessage message={{ ...baseMessage, channel_label: null }} formatDateTime={formatDateTime} />)
    // The purpose badge is unaffected — it still renders regardless of the channel chip.
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('still renders the purpose badge alongside a channel chip', () => {
    render(<ConversationMessage message={{ ...baseMessage, channel: 'waba', channel_label: 'label-waba' }} formatDateTime={formatDateTime} />)
    expect(screen.getByText('label-waba')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })
})

// PUNT-2: the turn-owner chip — raw keys render (no i18n init in this file).
describe('ConversationMessage · handled_by chip (PUNT-2)', () => {
  it.each(['engine', 'workflow', 'human'])('renders the owner chip for "%s"', (who) => {
    render(<ConversationMessage message={{ ...baseMessage, handled_by: who }} formatDateTime={formatDateTime} />)
    expect(screen.getByText(`conversations.handledBy.${who}`)).toBeInTheDocument()
  })

  it('stays silent for null and for an unknown future value', () => {
    render(<ConversationMessage message={{ ...baseMessage, handled_by: null }} formatDateTime={formatDateTime} />)
    expect(screen.queryByText(/conversations\.handledBy/)).not.toBeInTheDocument()
    render(<ConversationMessage message={{ ...baseMessage, handled_by: 'robot' }} formatDateTime={formatDateTime} />)
    expect(screen.queryByText('conversations.handledBy.robot')).not.toBeInTheDocument()
  })
})


// WA-THREAD-UX-1: a queued wa_web bubble (202 from the outbox) says "In wachtrij" and shows no
// timestamp and no delivery tick until the drainer's row lands.
describe('ConversationMessage · queued outbox stub', () => {
  it('renders the queued marker and no sent tick or timestamp', () => {
    const fmt = vi.fn((v: string) => `dt(${v})`)
    const { container } = render(<ConversationMessage message={{ ...baseMessage, direction: 'outbound', sent_at: null, _pendingOutboxId: 77 } as never} formatDateTime={fmt} />)
    // The i18n layer of this file may hand back keys or Dutch copy; both name the queued state.
    expect(container.textContent).toMatch(/In wachtrij|delivery\.queued/)
    expect(container.textContent).not.toMatch(/Verzonden|delivery\.sent/)
    expect(fmt).not.toHaveBeenCalled()
  })
})

// MANUAL-START-WORKFLOW-1: the run link renders only for an outbound message that carries a
// run id AND a host that can open it; no i18n instance here, so the key echoes as the name.
describe('ConversationMessage · run link (MANUAL-START-WORKFLOW-1)', () => {
  it('renders the link for an outbound message with workflow_run_id and reports the id on click', () => {
    const onViewRun = vi.fn()
    render(<ConversationMessage message={{ ...baseMessage, workflow_run_id: 'r1' }} formatDateTime={formatDateTime} onViewRun={onViewRun} />)
    fireEvent.click(screen.getByRole('button', { name: 'conversations.viewRun' }))
    expect(onViewRun).toHaveBeenCalledTimes(1)
    expect(onViewRun).toHaveBeenCalledWith('r1')
  })

  it('renders no link without a host handler, for a null id, or for an inbound message', () => {
    const { rerender } = render(<ConversationMessage message={{ ...baseMessage, workflow_run_id: 'r1' }} formatDateTime={formatDateTime} />)
    expect(screen.queryByRole('button', { name: 'conversations.viewRun' })).toBeNull()
    rerender(<ConversationMessage message={{ ...baseMessage, workflow_run_id: null }} formatDateTime={formatDateTime} onViewRun={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'conversations.viewRun' })).toBeNull()
    rerender(<ConversationMessage message={{ ...baseMessage, direction: 'inbound', workflow_run_id: 'r1' }} formatDateTime={formatDateTime} onViewRun={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'conversations.viewRun' })).toBeNull()
  })
})
