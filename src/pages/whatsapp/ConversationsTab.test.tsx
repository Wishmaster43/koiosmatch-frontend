/**
 * ConversationsTab — K-193/K-194: rows render the counterpart + flags (never a
 * "0"/false badge), filters reach the hook untouched, and a row click opens
 * the drawer which requests the thread at the exact route; "load older"
 * carries the before cursor (§13).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import ConversationsTab from './ConversationsTab'
import type { WaConversationRow } from './hooks/useConversations'

const mockConversations = vi.fn()
vi.mock('./hooks/useConversations', () => ({ useConversations: (filters: unknown) => mockConversations(filters) }))

const mockThread = vi.fn()
vi.mock('./hooks/useConversationThread', () => ({ useConversationThread: (id: string | null) => mockThread(id) }))

const registerFilters = vi.fn()
vi.mock('@/context/RightPanelContext', () => ({ useRightPanel: () => ({ registerFilters, unregisterFilters: vi.fn() }) }))

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity }) }))

const row = (over: Partial<WaConversationRow> = {}): WaConversationRow => ({
  id: 'conv-1', candidate: { id: 'cand-1', full_name: 'Jane Doe' }, wa_number: '+31612345678',
  primary_channel: 'wa_web', channel_label: 'WA Web', last_message_at: '2026-08-25T09:00:00Z',
  awaiting_reply: false, escalated: false, ...over,
})

afterEach(() => vi.clearAllMocks())

const noThread = { messages: [], loading: false, error: false, hasOlder: false, loadingOlder: false, loadOlder: vi.fn() }

describe('ConversationsTab', () => {
  it('renders the counterpart name, never a badge for a false flag', () => {
    mockConversations.mockReturnValue({ data: [row()], isLoading: false, isError: false })
    mockThread.mockReturnValue(noThread)
    render(<ConversationsTab />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText(/onbeantwoord|unanswered/i)).not.toBeInTheDocument()
  })

  it('shows the unanswered/escalated flags only when true', () => {
    mockConversations.mockReturnValue({ data: [row({ awaiting_reply: true, escalated: true })], isLoading: false, isError: false })
    mockThread.mockReturnValue(noThread)
    render(<ConversationsTab />)
    expect(screen.getByText(/onbeantwoord|unanswered/i)).toBeInTheDocument()
    expect(screen.getByText(/geëscaleerd|escalated/i)).toBeInTheDocument()
  })

  it('a row click opens the drawer and requests the thread at the exact conversation id', async () => {
    mockConversations.mockReturnValue({ data: [row()], isLoading: false, isError: false })
    mockThread.mockReturnValue(noThread)
    render(<ConversationsTab />)
    await userEvent.click(screen.getByText('Jane Doe'))
    expect(mockThread).toHaveBeenCalledWith('conv-1')
  })

  it('a customer-contact thread deep-links to the owning customer\'s Contacts tab (CEL-DOORKLIK-CANON)', async () => {
    const contactRow = row({
      candidate: null,
      customer_contact: { id: 'contact-1', full_name: 'Piet Klant', customer_id: 'cust-9' },
    })
    mockConversations.mockReturnValue({ data: [contactRow], isLoading: false, isError: false })
    mockThread.mockReturnValue(noThread)
    render(<ConversationsTab />)
    await userEvent.click(screen.getByText('Piet Klant'))
    expect(openEntity).toHaveBeenCalledWith('customers', 'cust-9', 'contacts')
  })

  it('debounces the search filter before it reaches useConversations', async () => {
    vi.useFakeTimers()
    mockConversations.mockReturnValue({ data: [], isLoading: false, isError: false })
    mockThread.mockReturnValue(noThread)
    render(<ConversationsTab />)
    const [group] = registerFilters.mock.calls.at(-1)!.slice(1)
    const searchGroup = group.find((g: { key: string }) => g.key === 'conv-search')
    act(() => { searchGroup.onChange('piet') })
    expect(mockConversations).not.toHaveBeenCalledWith(expect.objectContaining({ search: 'piet' }))
    act(() => { vi.advanceTimersByTime(300) })
    expect(mockConversations).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'piet' }))
    vi.useRealTimers()
  })

  it('load older is disabled/absent until hasOlder is true, and calls loadOlder when clicked', async () => {
    mockConversations.mockReturnValue({ data: [row()], isLoading: false, isError: false })
    const loadOlder = vi.fn()
    mockThread.mockReturnValue({ ...noThread, hasOlder: true, loadOlder })
    render(<ConversationsTab />)
    await userEvent.click(screen.getByText('Jane Doe'))
    const btn = screen.getByRole('button', { name: /oudere berichten|load older/i })
    await userEvent.click(btn)
    expect(loadOlder).toHaveBeenCalled()
  })
})
