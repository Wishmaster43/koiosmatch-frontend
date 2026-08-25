/**
 * WaConversationPanel.test — WA-MSG-TABLE-2 (K-194): the clicked log row opens
 * its OWN thread via `GET /conversations/{conversation_id}/messages` (never a
 * client-side filter over the loaded log page), full message text (never the
 * table's ellipsis), and a row with no `conversation_id` degrades to itself.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import WaConversationPanel from './WaConversationPanel'
import type { WaMessage } from '@/types/whatsapp'

vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => `dt:${v}`, locale: 'nl-NL' }) }))

const apiGet = vi.fn()
vi.mock('@/lib/api', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
  unwrapList: (r: { data: { data: unknown[] } }) => ({ rows: r.data.data }),
}))

const noop = () => {}
const cand = { id: 'c1', first_name: 'Yara', last_name: 'Groen' }
const msg = (over: Partial<WaMessage>): WaMessage =>
  ({ id: 'm', conversation_id: 'conv-1', direction: 'outbound', body: 'x', sent_at: '2026-08-01T10:00:00', candidate: cand, ...over } as WaMessage)

afterEach(() => { apiGet.mockClear() })

describe('WaConversationPanel · WA-MSG-TABLE-2', () => {
  it('fetches the thread by the clicked row\'s conversation_id, oldest first, full text', async () => {
    const long = 'Dit is een lange boodschap die in de tabel zou afbreken maar hier volledig leesbaar moet zijn.'
    apiGet.mockResolvedValueOnce({ data: { data: [
      // The server pages newest-first from the `before` anchor; the panel reverses to oldest-first.
      { id: 'm2', direction: 'inbound', message_content: long, sent_at: '2026-08-02T09:00:00' },
      { id: 'm1', direction: 'outbound', message_content: 'Eerste bericht', sent_at: '2026-08-01T10:00:00' },
    ] } })

    render(<WaConversationPanel message={msg({ id: 'm1', conversation_id: 'conv-1' })} onClose={noop} />)

    await waitFor(() => expect(screen.getByText(long)).toBeInTheDocument())
    expect(apiGet).toHaveBeenCalledWith('/conversations/conv-1/messages', { params: { before: expect.any(String), per_page: 100 } })
    expect(screen.getByText('Yara Groen')).toBeInTheDocument()
    expect(screen.getByText('Eerste bericht')).toBeInTheDocument()
    // House-format timestamp rides each bubble.
    expect(screen.getByText('dt:2026-08-01T10:00:00')).toBeInTheDocument()
  })

  it('a row with no conversation_id shows just itself, without a fetch', async () => {
    const loose = msg({ id: 'l1', body: 'Los systeembericht', conversation_id: null, candidate: undefined })
    render(<WaConversationPanel message={loose} onClose={noop} />)
    await waitFor(() => expect(screen.getByText('Los systeembericht')).toBeInTheDocument())
    expect(apiGet).not.toHaveBeenCalled()
    expect(screen.getByText('waLog.conversationUnknown')).toBeInTheDocument()
  })

  it('a fetch failure renders the shared error state', async () => {
    apiGet.mockRejectedValueOnce(new Error('boom'))
    render(<WaConversationPanel message={msg({ conversation_id: 'conv-2' })} onClose={noop} />)
    await waitFor(() => expect(screen.getByText('error.body')).toBeInTheDocument())
  })
})
