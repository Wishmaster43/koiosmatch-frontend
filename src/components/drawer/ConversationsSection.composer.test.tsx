/** ConversationsSection · composer concern: session composer, composer gate and send outcomes (WHATSAPP-COMPOSE-1, WA-SEND-TRANSPORT-1). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationsSection from './ConversationsSection'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
vi.mock('@/lib/datetime', () => ({
  useDateFormat: () => ({ formatDate: (v: string) => `d(${v})`, formatDateTime: (v: string) => `dt(${v})`, locale: 'nl-NL' }),
}))
// WA-SEND-TRANSPORT-1: 409/502 must render INLINE, never a toast — mocked so the
// negative "never called" assertions below are meaningful.
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// G27: ConversationAssistSection makes its own real POST-capable call — mocked here
// (it has its own dedicated test file) so the pre-existing tests above never fire it.
vi.mock('./conversationAssistApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./conversationAssistApi')>()
  return { ...actual, assistConversation: vi.fn() }
})

const THREADS = [{ id: 'conv-1', wa_number: '+31612345678', last_message_at: '2026-07-17T09:00:00Z', is_active: true, escalated: false, last_handled_by: 'workflow' }]
const MESSAGES = [
  { id: 'm1', direction: 'inbound', message_content: 'Hoi, ben ik nog nodig?', sent_at: '2026-07-17T08:00:00Z', purpose: null },
  { id: 'm2', direction: 'outbound', message_content: 'Ja! We plannen een intake.', sent_at: '2026-07-17T09:00:00Z', purpose: 'interview' },
]

// ONIX R-001: freeze ONLY Date so the Date.now()-relative recent/stale fixtures and the
// 24h-window maths cannot drift while a loaded machine is slow; timers stay real here.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/conversations') return Promise.resolve({ data: { data: THREADS } })
    if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
  vi.mocked(api.post).mockReset()
  vi.mocked(notifyError).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

// WHATSAPP-COMPOSE-1 (Danny 06-08): the free-text composer inside an OPEN thread —
// gated on the row's own `last_inbound_at` (Meta's 24h session anchor, the same
// field WhatsAppBundleSender gates session sends on server-side). Offered iff read:
// no indicator in the payload → no composer, ever, never a silent guess.
describe('ConversationsSection · session composer (WHATSAPP-COMPOSE-1)', () => {
  const threadWith = (lastInboundAt: string | null) => [{ ...THREADS[0], last_inbound_at: lastInboundAt }]

  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  })

  it('shows the composer when last_inbound_at is inside the 24h window', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString() // 1 minute ago
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: threadWith(recent) } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ConversationsSection composerEnabled threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByPlaceholderText('conversations.composerPlaceholder')).toBeInTheDocument()
    expect(screen.queryByText('conversations.sessionClosedHint')).not.toBeInTheDocument()
  })

  it('hides the composer and explains why when last_inbound_at is stale (session closed)', async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25h ago
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: threadWith(stale) } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ConversationsSection composerEnabled threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.sessionClosedHint')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('conversations.composerPlaceholder')).not.toBeInTheDocument()
  })

  it('hides the composer when the payload carries no last_inbound_at at all (never guess)', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: threadWith(null) } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ConversationsSection composerEnabled threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.sessionClosedHint')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('conversations.composerPlaceholder')).not.toBeInTheDocument()
  })

  it('sends via POST /conversations/{id}/messages with direction+message_content and appends the reply', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: threadWith(recent) } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: 'm3', direction: 'outbound', message_content: 'Tot morgen!', sent_at: '2026-08-06T10:00:00Z' },
    })
    const user = userEvent.setup()
    render(<ConversationsSection composerEnabled threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    await user.type(input, 'Tot morgen!')
    await user.click(screen.getByRole('button', { name: 'common:send' }))

    // §13: the request's method/route/body, not just that a callback fired.
    expect(api.post).toHaveBeenCalledWith('/conversations/conv-1/messages', {
      direction: 'outbound', message_content: 'Tot morgen!',
    }, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(await screen.findByText('Tot morgen!')).toBeInTheDocument()
    // The input clears after a successful send.
    expect(input).toHaveValue('')
  })

  // WA-COMPOSER-1: Shift+Enter inserts a newline into the draft, plain Enter sends
  // the multi-line draft as-is — the request body carries the real newline (§13).
  it('Shift+Enter adds a newline, a bare Enter sends the multi-line draft', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: threadWith(recent) } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: 'm4', direction: 'outbound', message_content: 'regel 1\nregel 2', sent_at: '2026-08-06T10:00:00Z' },
    })
    const user = userEvent.setup()
    render(<ConversationsSection composerEnabled threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    await user.type(input, 'regel 1{Shift>}{Enter}{/Shift}regel 2')
    expect(api.post).not.toHaveBeenCalled()
    await user.type(input, '{Enter}')

    expect(api.post).toHaveBeenCalledWith('/conversations/conv-1/messages', {
      direction: 'outbound', message_content: 'regel 1\nregel 2',
    }, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
  })

  // ONIX N-007: two synchronous Enter presses must POST exactly once — the
  // first send stays in flight (never resolved here) while the second Enter fires.
  it('two synchronous Enter presses send once (re-entrancy latch)', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: threadWith(recent) } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    // Never resolves within this test — proves the SECOND Enter is dropped
    // while the first POST is still pending, not merely fast.
    vi.mocked(api.post).mockReturnValueOnce(new Promise(() => {}))
    render(<ConversationsSection composerEnabled threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    fireEvent.change(input, { target: { value: 'Tot morgen!' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(api.post).toHaveBeenCalledTimes(1)
  })

  // WA-COMPOSER-1: the Bold toolbar button wraps the selected draft text in `*`.
  it('the Bold toolbar button wraps the selected text with *', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: threadWith(recent) } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    const user = userEvent.setup()
    render(<ConversationsSection composerEnabled threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder') as HTMLTextAreaElement
    await user.type(input, 'urgent')
    input.setSelectionRange(0, input.value.length)
    await user.click(screen.getByRole('button', { name: 'conversations.composer.bold' }))

    expect(input).toHaveValue('*urgent*')
  })
})

// WA-SEND-TRANSPORT-1: now that /conversations/{id}/messages really sends (verified
// read of MessageController::store/sendSessionReply), the composer is ON by default
// for every real caller — but a caller can still opt out via the prop.
describe('ConversationsSection · composer gate (WA-SEND-TRANSPORT-1 landed)', () => {
  it('renders the composer by default inside an open 24h session — no prop needed', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: [{ ...THREADS[0], last_inbound_at: recent }] } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    // No composerEnabled prop passed at all — proves the DEFAULT is now ON.
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText(MESSAGES[0].message_content)).toBeInTheDocument()
    expect(await screen.findByPlaceholderText('conversations.composerPlaceholder')).toBeInTheDocument()
  })

  it('still allows a caller to opt out via composerEnabled={false}', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: [{ ...THREADS[0], last_inbound_at: recent }] } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ConversationsSection composerEnabled={false} threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText(MESSAGES[0].message_content)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('conversations.composerPlaceholder')).toBeNull()
  })
})

// WA-SEND-TRANSPORT-1: the real send outcomes — 201 (sent, thread refreshed), 409
// (sender declined, inline server reason, draft kept) and 502 (gateway unreachable,
// inline honest retry notice, draft kept). Neither failure path ever toasts — §13:
// asserts the request AND the resulting UI, not just that a callback fired.
describe('ConversationsSection · send outcomes (WA-SEND-TRANSPORT-1)', () => {
  const recent = new Date(Date.now() - 60_000).toISOString()

  it('201: appends the reply and refreshes the thread row from the server', async () => {
    let conversationsCalls = 0
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') {
        conversationsCalls += 1
        // First load carries the ORIGINAL last_message_at; the post-send refetch
        // returns an UPDATED one — proves the row comes from the server, not a guess.
        const lastMessageAt = conversationsCalls === 1 ? '2026-07-17T09:00:00Z' : '2026-08-06T10:05:00Z'
        return Promise.resolve({ data: { data: [{ ...THREADS[0], last_inbound_at: recent, last_message_at: lastMessageAt }] } })
      }
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: 'm3', direction: 'outbound', message_content: 'Zo goed?', sent_at: '2026-08-06T10:05:00Z' },
    })
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('d(2026-07-17T09:00:00Z)')).toBeInTheDocument()

    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    await user.type(input, 'Zo goed?')
    await user.click(screen.getByRole('button', { name: 'common:send' }))

    expect(api.post).toHaveBeenCalledWith('/conversations/conv-1/messages', {
      direction: 'outbound', message_content: 'Zo goed?',
    }, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(await screen.findByText('Zo goed?')).toBeInTheDocument()
    expect(input).toHaveValue('')
    // The header date now reflects the server's OWN last_message_at after the refetch.
    expect(await screen.findByText('d(2026-08-06T10:05:00Z)')).toBeInTheDocument()
  })

  it('409: shows the server\'s own reason inline, keeps the draft, never toasts', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: [{ ...THREADS[0], last_inbound_at: recent }] } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 409, data: { message: 'Het 24-uursvenster is gesloten.' } } })
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    await user.type(input, 'Nog een poging')
    await user.click(screen.getByRole('button', { name: 'common:send' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Het 24-uursvenster is gesloten.')
    // Not sent: the draft stays exactly as typed, so retrying is just hitting send again.
    expect(input).toHaveValue('Nog een poging')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('502: shows an honest retry message inline, keeps the draft, never toasts', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: [{ ...THREADS[0], last_inbound_at: recent }] } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 502, data: { message: 'Versturen via WhatsApp is nu niet mogelijk; er is niets verzonden.' } } })
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    await user.type(input, 'Zo terug')
    await user.click(screen.getByRole('button', { name: 'common:send' }))

    // 502 is our OWN honest i18n copy, not the raw server body — the gateway itself
    // may not even return well-formed JSON, so this never depends on it.
    expect(await screen.findByRole('alert')).toHaveTextContent('conversations.composerUnavailable')
    expect(input).toHaveValue('Zo terug')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('clears a previous inline error once a new send attempt starts', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: [{ ...THREADS[0], last_inbound_at: recent }] } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.post)
      .mockRejectedValueOnce({ response: { status: 409, data: { message: 'Even niet.' } } })
      .mockResolvedValueOnce({ data: { id: 'm9', direction: 'outbound', message_content: 'Nu wel', sent_at: '2026-08-06T10:00:00Z' } })
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    await user.type(input, 'Nu wel')
    await user.click(screen.getByRole('button', { name: 'common:send' }))
    expect(await screen.findByText('Even niet.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'common:send' }))
    await waitFor(() => expect(screen.queryByText('Even niet.')).not.toBeInTheDocument())
  })
})
