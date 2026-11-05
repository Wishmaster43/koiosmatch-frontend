/** ConversationsSection · thread concern: 24h window, WA-THREAD-UX-1, landed-message merge and composerNotice. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConversationsSection from './ConversationsSection'
import { mergeLandedMessages } from './conversationThreadMerge'
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

  it('a thread with NO known owner at all gets an honest notice, never a dead picker', async () => {
    mockThreads([{ ...THREADS[0], last_inbound_at: null }])
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.templateNeedsCandidate')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conversations\.templatePlaceholder/ })).toBeNull()
  })

  // CONTACT-CONVERSATION-START: a customer-contact thread now sends a template
  // through the exact same route as a candidate one — the old "no candidate" dead
  // end only fires when NEITHER owner is known (the test above).
  it('a customer-contact thread (customer_contact_id, no candidate) renders the template picker too', async () => {
    mockThreads([{ ...THREADS[0], last_inbound_at: null, customer_contact_id: 'contact-1' }])
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByRole('button', { name: /conversations\.templatePlaceholder/ })).toBeInTheDocument()
    expect(screen.queryByText('conversations.templateNeedsCandidate')).not.toBeInTheDocument()
  })

  // CONTACT-CONVERSATION-START: the normalized `owner` block (ConversationResource)
  // is preferred over the raw candidate_id/customer_contact_id fields, and its name
  // feeds the thread heading when no nested candidate/wa_number name is present.
  it('prefers the normalized owner block for both the subject and the thread heading', async () => {
    mockThreads([{ id: 'conv-1', wa_number: null, last_inbound_at: null, is_active: true,
      owner: { type: 'customer_contact', id: 'contact-1', name: 'Jamie Vos' } }])
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('Jamie Vos')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /conversations\.templatePlaceholder/ })).toBeInTheDocument()
  })

  it('says the window is UNKNOWN when the payload carries no anchor field at all', async () => {
    // No `last_inbound_at` key whatsoever — an older/partial API shape.
    mockThreads([{ id: 'conv-1', candidate_id: 'cand-1', wa_number: '+31612345678', is_active: true }])
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.windowUnknown')).toBeInTheDocument()
    expect(screen.queryByText('conversations.sessionClosedHint')).not.toBeInTheDocument()
  })
})

// WA-THREAD-UX-1: channel-aware composer + sort toggle + queued-status refresh.
// ONIX R-001: step the fake clock in small slices until the condition holds, so a timer
// scheduled late (loaded machine) is still reached. RTL's waitFor runs on the FAKE clock
// here, so this is a plain bounded loop (virtual 5 min max), never a longer wall wait.
async function advanceUntil(cond: () => boolean, maxMs = 300_000) {
  for (let i = 0; i < Math.ceil(maxMs / 5_000) && !cond(); i += 1) {
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
  }
  expect(cond()).toBe(true)
}

describe('ConversationsSection · WA-THREAD-UX-1', () => {
  it('shows the free-text composer on a wa_web thread with a closed window, and posts the same request shape', async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // window closed
    const waWebThread = [{ ...THREADS[0], primary_channel: 'wa_web', last_inbound_at: stale }]
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: waWebThread } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.post).mockResolvedValueOnce({ status: 202, data: { outbox_id: 'ob-1', status: 'queued' } })
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

    // Closed window, wa_web channel: still the free-text composer, never the template picker.
    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    expect(screen.queryByText('conversations.sessionClosedHint')).not.toBeInTheDocument()
    expect(screen.getByText('conversations.waWebComposerHint')).toBeInTheDocument()

    await user.type(input, 'Hoi daar!')
    await user.click(screen.getByRole('button', { name: 'common:send' }))
    // §13: the request's method/route/body — identical shape to the WABA session send.
    expect(api.post).toHaveBeenCalledWith('/conversations/conv-1/messages', {
      direction: 'outbound', message_content: 'Hoi daar!',
    }, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
  })

  it('still shows the template picker on a waba thread with a closed window (unchanged)', async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const wabaThread = [{ ...THREADS[0], primary_channel: 'waba', last_inbound_at: stale }]
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: wabaThread } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    expect(await screen.findByText('conversations.sessionClosedHint')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('conversations.composerPlaceholder')).not.toBeInTheDocument()
  })

  it('flips the render order with the sort toggle and persists the choice in localStorage', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: THREADS } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    localStorage.removeItem('km:conversation-sort')
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    await screen.findByText(MESSAGES[0].message_content)

    // Default: oldest first — the inbound message (08:00) renders before the outbound one (09:00).
    let bubbles = screen.getAllByText(/ben ik nog nodig|We plannen een intake/)
    expect(bubbles[0]).toHaveTextContent('ben ik nog nodig')

    await user.click(screen.getByText('conversations.sortNewestFirst'))
    bubbles = screen.getAllByText(/ben ik nog nodig|We plannen een intake/)
    expect(bubbles[0]).toHaveTextContent('We plannen een intake')
    expect(localStorage.getItem('km:conversation-sort')).toBe('newest')
  })

  // NOTE: uses fireEvent (not userEvent) under fake timers — userEvent's own
  // internal delays fight vi's fake clock and hang the test.
  it('refetches a wa_web thread with a queued send after the 60s drainer-cadence timer', async () => {
    // shouldAdvanceTime keeps RTL's own real-timer polling (findBy*/waitFor) alive
    // while still letting us fast-forward the 60s refresh timer deterministically.
    vi.useRealTimers() // drop the Date-only freeze before installing the full fake clock
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const waWebThread = [{ ...THREADS[0], primary_channel: 'wa_web' }]
      // The refetch never resolves within the test, so the pending stub (and the
      // effect's condition to keep polling) stays in place while we advance the clock.
      let getCount = 0
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === '/conversations') return Promise.resolve({ data: { data: waWebThread } })
        if (url === '/conversations/conv-1/messages') {
          getCount += 1
          return getCount === 1 ? Promise.resolve({ data: { data: MESSAGES } }) : new Promise(() => {})
        }
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
      vi.mocked(api.post).mockResolvedValueOnce({ status: 202, data: { outbox_id: 'ob-2', status: 'queued' } })
      render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

      // Fake-clock steps instead of wall-clock findBy*: a loaded machine cannot starve them.
      await advanceUntil(() => screen.queryByPlaceholderText('conversations.composerPlaceholder') !== null)
      const input = screen.getByPlaceholderText('conversations.composerPlaceholder')
      fireEvent.change(input, { target: { value: 'Nog een berichtje' } })
      fireEvent.click(screen.getByRole('button', { name: 'common:send' }))
      await advanceUntil(() => vi.mocked(api.post).mock.calls.length > 0)
      // The refresh timer is scheduled when the 202 lands and the pending bubble renders —
      // wait for the bubble, or a loaded machine advances the clock before the timer exists.
      await advanceUntil(() => screen.queryByText('conversations.delivery.queued') !== null)
      const callsBeforeTimer = getCount

      // The 60s drainer-cadence timer refetches this thread's messages. Advance PAST the
      // cadence (shouldAdvanceTime moves the fake clock with real time too, so an exact
      // 60_000 can land a few ms short under CPU load) and wait for the refetch instead of
      // asserting synchronously — measured flake in two landings on 02-10.
      // Cadence bracket: no early refetch at +50 s, and the refetch lands by ~+70 s (a 4-minute poll fails).
      await act(async () => { await vi.advanceTimersByTimeAsync(50_000) })
      expect(getCount).toBe(callsBeforeTimer)
      await advanceUntil(() => getCount > callsBeforeTimer, 20_000)
    } finally {
      vi.useRealTimers()
    }
  })

  // Verifier fix: a refetch that resolves BEFORE the drainer wrote the real row
  // must not drop the just-sent bubble, and polling must keep going (never a
  // one-shot poll that gives up the moment a read lands empty-handed).
  it('keeps the pending bubble and keeps polling when a refetch resolves without the queued row yet', async () => {
    vi.useRealTimers() // drop the Date-only freeze before installing the full fake clock
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const waWebThread = [{ ...THREADS[0], primary_channel: 'wa_web' }]
      let getCount = 0
      vi.mocked(api.get).mockImplementation((url: string) => {
        if (url === '/conversations') return Promise.resolve({ data: { data: waWebThread } })
        if (url === '/conversations/conv-1/messages') {
          getCount += 1
          // Every GET, including the post-timer refetch, still answers WITHOUT the
          // queued send — the drainer has not written the row yet.
          return Promise.resolve({ data: { data: MESSAGES } })
        }
        return Promise.reject(new Error(`unexpected GET ${url}`))
      })
      vi.mocked(api.post).mockResolvedValueOnce({ status: 202, data: { outbox_id: 'ob-4', status: 'queued' } })
      render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

      // Fake-clock steps instead of wall-clock findBy*: a loaded machine cannot starve them.
      await advanceUntil(() => screen.queryByPlaceholderText('conversations.composerPlaceholder') !== null)
      const input = screen.getByPlaceholderText('conversations.composerPlaceholder')
      fireEvent.change(input, { target: { value: 'Wachtrij-bericht' } })
      fireEvent.click(screen.getByRole('button', { name: 'common:send' }))
      await advanceUntil(() => vi.mocked(api.post).mock.calls.length > 0)
      // The refresh timer is scheduled when the 202 lands and the pending bubble renders —
      // wait for the bubble, or a loaded machine advances the clock before the timer exists.
      await advanceUntil(() => screen.queryByText('conversations.delivery.queued') !== null)
      const callsBeforeTimer = getCount

      // First backoff step (60s): the refetch resolves without the queued row.
      // Advance PAST the cadence and await the refetch (same shape as FLAKE-WA-TIMER-1).
      await act(async () => { await vi.advanceTimersByTimeAsync(50_000) })
      expect(getCount).toBe(callsBeforeTimer)
      await advanceUntil(() => getCount > callsBeforeTimer, 20_000)
      // The pending bubble is still on screen — a bare replace would have dropped it.
      expect(screen.getByText('Wachtrij-bericht')).toBeInTheDocument()

      // Second backoff step (still 60s, attempt index 1): polling continues.
      const callsBeforeSecondTimer = getCount
      await act(async () => { await vi.advanceTimersByTimeAsync(50_000) })
      expect(getCount).toBe(callsBeforeSecondTimer)
      await advanceUntil(() => getCount > callsBeforeSecondTimer, 20_000)
      expect(screen.getByText('Wachtrij-bericht')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('refetches a wa_web thread with a queued send when the window regains focus', async () => {
    const waWebThread = [{ ...THREADS[0], primary_channel: 'wa_web' }]
    let getCount = 0
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: waWebThread } })
      if (url === '/conversations/conv-1/messages') {
        getCount += 1
        // The first (mount) fetch resolves with the queued stub still absent from the
        // server yet; later refetches never resolve so the effect keeps its listener.
        return getCount === 1 ? Promise.resolve({ data: { data: MESSAGES } }) : new Promise(() => {})
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    vi.mocked(api.post).mockResolvedValueOnce({ status: 202, data: { outbox_id: 'ob-3', status: 'queued' } })
    const user = userEvent.setup()
    render(<ConversationsSection threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)

    const input = await screen.findByPlaceholderText('conversations.composerPlaceholder')
    await user.type(input, 'Focus test')
    await user.click(screen.getByRole('button', { name: 'common:send' }))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const callsBeforeFocus = getCount

    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(getCount).toBeGreaterThan(callsBeforeFocus))
  })
})

// WA-THREAD-UX-1 verifier round 2: a queued stub is claimed only by a row the previous list did
// not hold — an older outbound bubble with the same text must never swallow it.
describe('mergeLandedMessages · a pre-existing identical outbound row never claims the stub', () => {
  const older = { id: 'm9', direction: 'outbound', message_content: 'Top!', sent_at: '2026-07-17T08:00:00Z' }
  const stub = { id: 'pending-77', direction: 'outbound', message_content: 'Top!', sent_at: null, _pendingOutboxId: 77 }
  it('keeps the stub while the server list only holds the older twin', () => {
    const merged = mergeLandedMessages([older] as never, [older, stub] as never)
    expect(merged.map(m => m.id)).toEqual(['m9', 'pending-77'])
  })
  it('drops the stub once a NEW outbound row with that text lands', () => {
    const landed = { id: 'm10', direction: 'outbound', message_content: 'Top!', sent_at: '2026-07-17T09:01:00Z' }
    const merged = mergeLandedMessages([older, landed] as never, [older, stub] as never)
    expect(merged.map(m => m.id)).toEqual(['m9', 'm10'])
  })
})

// K-008: composerNotice renders once above the composer, and only when supplied.
describe('ConversationsSection · composerNotice (K-008)', () => {
  const open = () => vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/conversations') return Promise.resolve({ data: { data: [{ ...THREADS[0], last_inbound_at: new Date(Date.now() - 60_000).toISOString() }] } })
    if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })

  it('renders the supplied notice above the composer', async () => {
    open()
    render(<ConversationsSection composerEnabled composerNotice={<p>notice-line</p>} threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    await screen.findByPlaceholderText('conversations.composerPlaceholder')
    expect(screen.getAllByText('notice-line')).toHaveLength(1)
  })

  it('renders no notice by default', async () => {
    open()
    render(<ConversationsSection composerEnabled threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    await screen.findByPlaceholderText('conversations.composerPlaceholder')
    expect(screen.queryByText('notice-line')).toBeNull()
  })

  it('renders no notice above the template picker (closed window, not wa_web)', async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: { data: [{ ...THREADS[0], primary_channel: 'waba', last_inbound_at: stale }] } })
      if (url === '/conversations/conv-1/messages') return Promise.resolve({ data: { data: MESSAGES } })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    render(<ConversationsSection composerEnabled composerNotice={<p>notice-line</p>} threadsUrl="/conversations" threadsParams={{ candidate_id: 'cand-1' }} />)
    await screen.findByText('conversations.sessionClosedHint')
    expect(screen.queryByText('notice-line')).toBeNull()
  })
})
