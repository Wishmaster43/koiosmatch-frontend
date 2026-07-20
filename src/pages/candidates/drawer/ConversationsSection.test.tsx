/**
 * ConversationsSection — CONV-DRILLDOWN-FE. Proves the panel actually CALLS the
 * endpoint (the bug it replaces was a hardcoded-empty placeholder): the list
 * request carries ?candidate_id, threads render with the is_active badge, and
 * expanding a thread fetches + renders its messages with the purpose badge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationsSection from './ConversationsSection'
import api from '@/lib/api'

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

  it('expands a thread and renders its messages with the purpose badge', async () => {
    const user = userEvent.setup()
    render(<ConversationsSection candidateId="cand-1" />)
    await user.click(await screen.findByText('+31612345678'))
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
})
