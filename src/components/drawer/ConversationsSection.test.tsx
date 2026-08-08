/**
 * ConversationsSection — CONV-DRILLDOWN-FE, promoted to components/drawer/
 * (GESPREK-CONTACT-1). Proves the panel actually CALLS the endpoint the
 * caller points it at via `threadsUrl`/`threadsParams` (the bug it replaces
 * was a hardcoded-empty placeholder): the list request carries the caller's
 * params, threads render with the is_active badge, and expanding a thread
 * fetches + renders its messages with the purpose badge.
 * Also covers the four polish refinements: auto-expand, candidate-name heading,
 * WhatsApp-style delivery ticks and per-sender colour coding.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationsSection from './ConversationsSection'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { avatarColor } from '@/lib/avatarColor'
import { assistConversation } from './conversationAssistApi'

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
  vi.mocked(api.post).mockReset()
  vi.mocked(notifyError).mockReset()
})

describe('ConversationsSection', () => {
  it('fetches the caller-scoped threads and shows the active badge', async () => {
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    // The core CONV-DRILLDOWN-FE fix: the panel calls the endpoint, scoped by the caller's params.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations', { params: { candidate_id: 'cand-1' } }))
    expect(await screen.findByText('+31612345678')).toBeInTheDocument()
    expect(screen.getByText('conversations.active')).toBeInTheDocument()
  })

  it('auto-expands the single thread and renders its messages with the purpose badge', async () => {
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    // Refinement 1: a lone thread opens itself — no click needed to see anything.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations/conv-1/messages'))
    expect(await screen.findByText('Ja! We plannen een intake.')).toBeInTheDocument()
    // The outbound message's purpose renders as a badge — humanised fallback when
    // the tenant slug has no explicit translation key yet.
    expect(screen.getByText('Interview')).toBeInTheDocument()
  })

  it('shows the empty state only when the fetch returns zero threads', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-2' }} />)
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
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
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
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
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
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
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

  it('refetches when the caller-passed params VALUE changes, even with a fresh object literal', async () => {
    // Guards the paramsKey serialization: a new inline object each render must not be
    // ignored just because the params VALUE (candidate_id) actually changed.
    const otherThreads = [{ id: 'conv-9', wa_number: '+31600000000', last_message_at: '2026-07-18T09:00:00Z', is_active: true, escalated: false }]
    vi.mocked(api.get).mockImplementation((url: string, config?: { params?: { candidate_id?: string } }) => {
      if (url === '/conversations' && config?.params?.candidate_id === 'cand-1') return Promise.resolve({ data: { data: THREADS } })
      if (url === '/conversations' && config?.params?.candidate_id === 'cand-9') return Promise.resolve({ data: { data: otherThreads } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      if (url === '/conversations/conv-9/messages') return Promise.resolve({ data: { data: [] } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    const { rerender } = render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('+31612345678')).toBeInTheDocument()
    // A brand-new object literal, same shape, different value — must trigger a refetch.
    rerender(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-9' }} />)
    expect(await screen.findByText('+31600000000')).toBeInTheDocument()
  })

  it('renders the caller-supplied headerAction next to the thread list', async () => {
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }}
      headerAction={<button>Start test action</button>} />)
    expect(await screen.findByText('Start test action')).toBeInTheDocument()
  })
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
    })
    expect(await screen.findByText('Tot morgen!')).toBeInTheDocument()
    // The input clears after a successful send.
    expect(input).toHaveValue('')
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
    })
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

// G27 / K2-CONV-ASSIST-1: the Koios AI assist affordance inside the open-session
// composer. ConversationAssistSection has its own dedicated unit tests (request
// per mode, apply/discard semantics, failure banner) — these prove the WIRING:
// it renders where the composer renders, is gated on the loaded thread's own
// messages, and "Overnemen" really lands in the SAME <input> the recruiter sends
// from (never a separate, invisible target) while "Verwerpen" leaves it untouched.
describe('ConversationsSection · Koios AI conversation assist (G27)', () => {
  const recent = new Date(Date.now() - 60_000).toISOString()

  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: [{ ...THREADS[0], last_inbound_at: recent }] } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(assistConversation).mockReset()
  })

  it('calls assistConversation with the conversation id + mode when Samenvatten is clicked', async () => {
    vi.mocked(assistConversation).mockResolvedValue({ kind: 'text', text: 'Kandidaat kan morgen starten.' })
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    await user.click(await screen.findByRole('button', { name: 'Samenvatten' }))
    expect(assistConversation).toHaveBeenCalledWith(expect.objectContaining({ id: 'conv-1', mode: 'summarize' }), expect.anything())
  })

  it('honestly disables the assist buttons when the loaded thread has zero messages', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: [{ ...THREADS[0], last_inbound_at: recent }] } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: [] } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByRole('button', { name: 'Samenvatten' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Actiepunten' })).toBeDisabled()
  })

  it('Overnemen writes the assist result straight into the composer draft input', async () => {
    vi.mocked(assistConversation).mockResolvedValue({ kind: 'text', text: 'Kandidaat kan morgen starten.' })
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    await user.click(await screen.findByRole('button', { name: 'Samenvatten' }))
    await screen.findByText('Kandidaat kan morgen starten.')
    await user.click(screen.getByRole('button', { name: 'Overnemen' }))
    const input = screen.getByPlaceholderText('conversations.composerPlaceholder')
    expect(input).toHaveValue('Kandidaat kan morgen starten.')
  })

  it('Verwerpen leaves an already-typed composer draft completely untouched', async () => {
    vi.mocked(assistConversation).mockResolvedValue({ kind: 'text', text: 'Kandidaat kan morgen starten.' })
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    await user.type(input, 'Mijn eigen concept')
    await user.click(screen.getByRole('button', { name: 'Samenvatten' }))
    await screen.findByText('Kandidaat kan morgen starten.')
    await user.click(screen.getByRole('button', { name: 'Verwerpen' }))
    expect(input).toHaveValue('Mijn eigen concept')
  })
})

// WA-WINDOW-1 (Danny punt 12, 08-08): "als het 24-uursvenster niet open is, hoe
// stuur ik dan een bericht?". The section must ANSWER that on screen: inside the
// window it says how long free text is still allowed, outside it it offers the
// only route Meta accepts — an approved template. TemplateComposer has its own
// dedicated test file; these prove the WIRING (which branch renders when, and
// with which candidate).
describe('ConversationsSection · 24h window state (WA-WINDOW-1)', () => {
  const threadWithInbound = (lastInboundAt: string | null) => [{ ...THREADS[0], candidate_id: 'cand-1', last_inbound_at: lastInboundAt }]

  const mockThreads = (rows: unknown[]) => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: rows } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      if (url === '/whatsapp-templates') return Promise.resolve({ data: { data: [] } })
      if (url === '/whatsapp-phone-numbers') return Promise.resolve({ data: { data: [] } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  }

  it('tells the recruiter how much of the 24h window is left, in hours and minutes', async () => {
    // 2h ago → 22h left. The line is derived from this row's own last_inbound_at.
    mockThreads(threadWithInbound(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()))
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.windowLeftHours')).toBeInTheDocument()
    expect(await screen.findByPlaceholderText('conversations.composerPlaceholder')).toBeInTheDocument()
  })

  it('switches to the minutes-only wording in the last hour of the window', async () => {
    mockThreads(threadWithInbound(new Date(Date.now() - (23 * 60 + 30) * 60 * 1000).toISOString()))
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.windowLeftMinutes')).toBeInTheDocument()
  })

  it('never claims "0 minutes left" while the window is demonstrably still open', async () => {
    // 30 seconds before the window closes: still open, but under a minute of it left.
    mockThreads(threadWithInbound(new Date(Date.now() - (24 * 60 * 60 * 1000 - 30_000)).toISOString()))
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.windowLeftSeconds')).toBeInTheDocument()
    expect(await screen.findByPlaceholderText('conversations.composerPlaceholder')).toBeInTheDocument()
  })

  it('offers the template route — with the thread\'s candidate — once the window has closed', async () => {
    mockThreads(threadWithInbound(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()))
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    // The reason stays, but now with a real way forward next to it.
    expect(await screen.findByText('conversations.sessionClosedHint')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /conversations\.templatePlaceholder/ })).toBeInTheDocument()
    // Its lookups are really loaded — the picker is wired, not a static placeholder.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/whatsapp-templates'))
    expect(api.get).toHaveBeenCalledWith('/whatsapp-phone-numbers')
  })

  it('falls back to the thread\'s nested candidate id when candidate_id is absent', async () => {
    mockThreads([{ ...THREADS[0], last_inbound_at: null, candidate: { id: 'cand-nested', first_name: 'Jamie', last_name: 'Vos' } }])
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    // A candidate IS known, so the picker renders instead of the "no candidate" notice.
    expect(await screen.findByRole('button', { name: /conversations\.templatePlaceholder/ })).toBeInTheDocument()
    expect(screen.queryByText('conversations.templateNeedsCandidate')).not.toBeInTheDocument()
  })

  it('a contact thread (no candidate at all) gets an honest notice, never a dead picker', async () => {
    mockThreads([{ ...THREADS[0], last_inbound_at: null }])
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.templateNeedsCandidate')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conversations\.templatePlaceholder/ })).toBeNull()
  })

  it('says the window is UNKNOWN when the payload carries no anchor field at all', async () => {
    // No `last_inbound_at` key whatsoever — an older/partial API shape.
    mockThreads([{ id: 'conv-1', candidate_id: 'cand-1', wa_number: '+31612345678', is_active: true }])
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.windowUnknown')).toBeInTheDocument()
    expect(screen.queryByText('conversations.sessionClosedHint')).not.toBeInTheDocument()
  })
})
