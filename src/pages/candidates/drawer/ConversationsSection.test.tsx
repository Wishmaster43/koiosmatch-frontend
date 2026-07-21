/**
 * ConversationsSection — CONV-DRILLDOWN-FE. Proves the panel actually CALLS the
 * endpoint (the bug it replaces was a hardcoded-empty placeholder): the list
 * request carries ?candidate_id, threads render with the is_active badge, and
 * expanding a thread fetches + renders its messages with the purpose badge.
 * Also covers the four polish refinements: auto-expand, candidate-name heading,
 * WhatsApp-style delivery ticks and per-sender colour coding.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationsSection from './ConversationsSection'
import api from '@/lib/api'
import { avatarColor } from '@/lib/avatarColor'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))

const THREADS = [{ id: 'conv-1', wa_number: '+31612345678', last_message_at: '2026-07-17T09:00:00Z', is_active: true, escalated: false }]
const MESSAGES = [
  { id: 'm1', direction: 'inbound', message_content: 'Hoi, ben ik nog nodig?', sent_at: '2026-07-17T08:00:00Z', purpose: null },
  { id: 'm2', direction: 'outbound', message_content: 'Ja! We plannen een intake.', sent_at: '2026-07-17T09:00:00Z', purpose: 'interview' },
]

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/conversations') return Promise.resolve({ data: { data: THREADS } })
    if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
})

describe('ConversationsSection', () => {
  it('fetches the candidate-scoped threads and shows the active badge', async () => {
    render(<ConversationsSection candidateId="cand-1" />)
    // The core CONV-DRILLDOWN-FE fix: the panel calls the endpoint, scoped by candidate.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations', { params: { candidate_id: 'cand-1' } }))
    expect(await screen.findByText('+31612345678')).toBeInTheDocument()
    expect(screen.getByText('conversations.active')).toBeInTheDocument()
  })

  it('auto-expands the single thread and renders its messages with the purpose badge', async () => {
    render(<ConversationsSection candidateId="cand-1" />)
    // Refinement 1: a lone thread opens itself — no click needed to see anything.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations/conv-1/messages'))
    expect(await screen.findByText('Ja! We plannen een intake.')).toBeInTheDocument()
    // The outbound message's purpose renders as a badge — humanised fallback when
    // the tenant slug has no explicit translation key yet.
    expect(screen.getByText('Interview')).toBeInTheDocument()
  })

  it('shows the empty state only when the fetch returns zero threads', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    render(<ConversationsSection candidateId="cand-2" />)
    expect(await screen.findByText('sections.conversationsEmpty')).toBeInTheDocument()
  })

  it('shows the candidate name as the thread heading with the number as subtext', async () => {
    // Refinement 2: the conversation row's candidate identity outranks the raw wa_number.
    const threadsWithName = [{ ...THREADS[0], candidate: { id: 'c1', first_name: 'Jamie', last_name: 'Vos' } }]
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: threadsWithName } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ConversationsSection candidateId="cand-1" />)
    expect(await screen.findByText('Jamie Vos')).toBeInTheDocument()
    expect(screen.getByText('+31612345678')).toBeInTheDocument()
  })

  it('auto-opens only the first thread when there are several, and toggles the rest on click', async () => {
    const twoThreads = [
      { id: 'conv-1', wa_number: '+31612345678', last_message_at: '2026-07-17T09:00:00Z', is_active: true, escalated: false },
      { id: 'conv-2', wa_number: '+31698765432', last_message_at: '2026-07-16T09:00:00Z', is_active: false, escalated: false },
    ]
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: twoThreads } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      if (url === '/conversations/conv-2/messages') return Promise.resolve({ data: { data: [] } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    const user = userEvent.setup()
    render(<ConversationsSection candidateId="cand-1" />)
    // The first thread's messages load automatically...
    expect(await screen.findByText('Ja! We plannen een intake.')).toBeInTheDocument()
    // ...the second does not, until it is clicked open.
    expect(api.get).not.toHaveBeenCalledWith('/conversations/conv-2/messages')
    await user.click(screen.getByText('+31698765432'))
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations/conv-2/messages'))
  })

  it('renders WhatsApp-style delivery ticks per outbound message state and colour-codes each sender', async () => {
    const messagesWithDelivery = [
      { id: 'm1', direction: 'outbound', message_content: 'sent only', sent_at: '2026-07-17T08:00:00Z', sent_by: { id: 'u1', name: 'Ravi' } },
      { id: 'm2', direction: 'outbound', message_content: 'delivered', sent_at: '2026-07-17T08:05:00Z', delivered_at: '2026-07-17T08:06:00Z', sent_by: { id: 'u1', name: 'Ravi' } },
      { id: 'm3', direction: 'outbound', message_content: 'read', sent_at: '2026-07-17T08:10:00Z', delivered_at: '2026-07-17T08:11:00Z', read_at: '2026-07-17T08:12:00Z', sent_by: { id: 'u2', name: 'Kelly' } },
    ]
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: THREADS } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: messagesWithDelivery } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ConversationsSection candidateId="cand-1" />)
    // Refinement 3: sent → single tick, delivered → double tick, read → double tick, each with an a11y label.
    expect(await screen.findByRole('img', { name: 'conversations.delivery.sent' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'conversations.delivery.delivered' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'conversations.delivery.read' })).toBeInTheDocument()
    // Refinement 4: the sender name shows above each outbound bubble in its hashed colour
    // (mirrors the shared Avatar/owner colour picker — never a second hash function).
    const ravi = screen.getAllByText('Ravi')[0]
    const kelly = screen.getByText('Kelly')
    expect(ravi).toHaveStyle({ color: avatarColor('Ravi') })
    expect(kelly).toHaveStyle({ color: avatarColor('Kelly') })
  })
})
