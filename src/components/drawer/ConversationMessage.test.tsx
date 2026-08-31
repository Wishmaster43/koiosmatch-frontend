/**
 * ConversationMessage — proves the K-193 channel chip renders per enum value
 * on the message bubble, stays silent for a null/unknown channel, and that
 * the purpose badge (the pre-existing seam) still renders alongside it.
 * No i18next instance is initialized in this test file, so t(key, {defaultValue})
 * resolves to the defaultValue — a distinct channel_label per case proves the
 * chip reads channel/channel_label off the message row.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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

