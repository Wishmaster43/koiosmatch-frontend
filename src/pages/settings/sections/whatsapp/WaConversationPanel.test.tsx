/**
 * WaConversationPanel.test — WA-LOG-LEESBAAR-1 (Danny 13-08 "de conversaties
 * moeten groter"): the clicked log row opens the candidate's WHOLE thread with
 * FULL message text (never the table's ellipsis), oldest first, and a
 * candidate-less row degrades to just itself.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WaConversationPanel from './WaConversationPanel'
import type { WaMessage } from '@/types/whatsapp'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => `dt:${v}`, locale: 'nl-NL' }) }))

const noop = () => {}
const cand = { id: 'c1', first_name: 'Yara', last_name: 'Groen' }
const msg = (over: Partial<WaMessage>): WaMessage => ({ id: 'm', direction: 'outbound', body: 'x', sent_at: '2026-08-01T10:00:00', candidate: cand, ...over } as WaMessage)

describe('WaConversationPanel · WA-LOG-LEESBAAR-1', () => {
  it('shows the WHOLE thread of the clicked row\'s candidate, oldest first, full text', () => {
    const long = 'Dit is een lange boodschap die in de tabel zou afbreken maar hier volledig leesbaar moet zijn.'
    const messages = [
      msg({ id: 'm2', body: long, sent_at: '2026-08-02T09:00:00', direction: 'inbound' }),
      msg({ id: 'm1', body: 'Eerste bericht', sent_at: '2026-08-01T10:00:00' }),
      // Another candidate's message never leaks into this thread.
      msg({ id: 'x1', body: 'Ander gesprek', candidate: { id: 'c2', first_name: 'Piet' } as WaMessage['candidate'] }),
    ]
    render(<WaConversationPanel message={messages[1]} messages={messages} onClose={noop} />)

    expect(screen.getByText('Yara Groen')).toBeInTheDocument()
    expect(screen.getByText(long)).toBeInTheDocument()
    expect(screen.queryByText('Ander gesprek')).toBeNull()
    // Chat order: oldest first (the log lists newest first).
    const bodies = screen.getAllByText(/Eerste bericht|lange boodschap/).map(e => e.textContent)
    expect(bodies[0]).toContain('Eerste bericht')
    // House-format timestamp rides each bubble.
    expect(screen.getByText('dt:2026-08-01T10:00:00')).toBeInTheDocument()
  })

  it('a candidate-less row shows just itself under the unknown-contact title', () => {
    const loose = msg({ id: 'l1', body: 'Los systeembericht', candidate: undefined })
    render(<WaConversationPanel message={loose} messages={[loose, msg({ id: 'm1' })]} onClose={noop} />)
    expect(screen.getByText('waLog.conversationUnknown')).toBeInTheDocument()
    expect(screen.getByText('Los systeembericht')).toBeInTheDocument()
  })
})
