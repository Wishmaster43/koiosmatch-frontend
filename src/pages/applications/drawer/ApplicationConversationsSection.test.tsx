/**
 * ApplicationConversationsSection — GESPREK-CONSISTENT-1-FE. Proves the wrapper
 * reads the PERSON's threads (candidate_id, never scoped to the application),
 * gates the start trigger on useCanStartConversation, opens the shared
 * StartConversationModal on click, and shows the honest notice with no request
 * at all when there is no candidate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApplicationConversationsSection from './ApplicationConversationsSection'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))
const mockUseCanStartConversation = vi.fn()
vi.mock('@/hooks/useCanStartConversation', () => ({ useCanStartConversation: () => mockUseCanStartConversation() }))
// TESTLES: a FLAT mock of the candidates barrel — never importOriginal on it
// (that would drag the whole candidate tree + i18n-init into this suite).
vi.mock('@/pages/candidates/shared', () => ({
  StartConversationModal: (props: { onClose: () => void }) => (
    <div data-testid="start-conversation-modal">
      <button onClick={props.onClose}>close-modal</button>
    </div>
  ),
}))

const THREADS = [{ id: 'conv-1', wa_number: '+31612345678', last_message_at: '2026-07-17T09:00:00Z', is_active: true, escalated: false }]

beforeEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/conversations') return Promise.resolve({ data: { data: THREADS } })
    if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: [] } })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
  mockUseCanStartConversation.mockReset()
  mockUseCanStartConversation.mockReturnValue(true)
})

describe('ApplicationConversationsSection', () => {
  it('reads the PERSON\'s threads — candidate_id, never scoped to the application', async () => {
    render(<ApplicationConversationsSection candidateId="cand-1" applicationId="app-1" />)
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations', { params: { candidate_id: 'cand-1' } }))
    expect(await screen.findByText('+31612345678')).toBeInTheDocument()
  })

  it('shows the start trigger with useCanStartConversation true', async () => {
    render(<ApplicationConversationsSection candidateId="cand-1" applicationId="app-1" />)
    expect(await screen.findByRole('button', { name: 'conversations.start' })).toBeInTheDocument()
  })

  it('hides the start trigger without useCanStartConversation', async () => {
    mockUseCanStartConversation.mockReturnValue(false)
    render(<ApplicationConversationsSection candidateId="cand-1" applicationId="app-1" />)
    await screen.findByText('+31612345678')
    expect(screen.queryByRole('button', { name: 'conversations.start' })).toBeNull()
  })

  it('opens the shared StartConversationModal on click', async () => {
    const user = userEvent.setup()
    render(<ApplicationConversationsSection candidateId="cand-1" applicationId="app-1" />)
    await user.click(await screen.findByRole('button', { name: 'conversations.start' }))
    expect(screen.getByTestId('start-conversation-modal')).toBeInTheDocument()
  })

  it('shows the honest no-candidate notice and makes no request at all', () => {
    render(<ApplicationConversationsSection candidateId={null} applicationId="app-1" />)
    expect(screen.getByText('applications:interview.conversation.noCandidate')).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })
})
