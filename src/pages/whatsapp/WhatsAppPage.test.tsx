/**
 * WhatsAppPage — nine-card KPI band (WA-KPI9-1). Covers: exactly nine cards in
 * every data state, the house dash for a value the server didn't (successfully)
 * return — never a padded zero for a genuinely empty-but-successful source, the
 * two new drillable cards wiring the page's own direction filter into the
 * hook's SERVER params (WA-MSG-TABLE-1 — direction/status now go to the
 * backend, not a client-side slice), and the four UI states (loading /
 * no-connection / empty / success).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import WhatsAppPage from './WhatsAppPage'
import type { WaStats, WaMessage, WaEscalation, WaActivityDatum, WaQueueBatch } from '@/types/whatsapp'
import type { WaMessageFilters } from './hooks/useWhatsAppData'

// Data layer under test control (loading/error/empty/success — the four UI states).
// The mock is called with the page's filters arg so drill/filter tests can assert
// the WIRING (the clicked KPI's direction reaches the hook call) — see fixtureFor().
const mockUseWhatsAppData = vi.fn()
vi.mock('./hooks/useWhatsAppData', () => ({ useWhatsAppData: (filters?: WaMessageFilters) => mockUseWhatsAppData(filters) }))

// Keep the real sumBatches() (pure aggregation, worth exercising for real) but
// control the hook's data/loading/error/notAvailable shape.
const mockUseWhatsAppQueue = vi.fn()
vi.mock('./hooks/useWhatsAppQueue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hooks/useWhatsAppQueue')>()
  return { ...actual, useWhatsAppQueue: () => mockUseWhatsAppQueue() }
})

// Lightweight stand-ins for the tab bodies — their own contracts are covered by
// components.test.tsx / QueueTab's own suite; this file stays focused on the KPI
// band + tab/filter wiring, and uses these to observe what the page hands down.
vi.mock('./components', () => ({
  EscalationList: ({ escalations, loading }: { escalations: WaEscalation[]; loading?: boolean }) =>
    <div data-testid="escalation-list">{loading ? 'loading' : escalations.length}</div>,
  ActivityChart: () => <div data-testid="activity-chart" />,
}))
vi.mock('./ChannelActivityChart', () => ({ default: () => <div data-testid="channel-activity-chart" /> }))
vi.mock('./messagesTable/MessagesTable', () => ({
  default: ({ messages, loading, exhausted }: { messages: WaMessage[]; loading?: boolean; exhausted?: boolean }) =>
    <div data-testid="messages-table" data-exhausted={String(!!exhausted)}>{loading ? 'loading' : messages.length}</div>,
}))
vi.mock('./QueueTab', () => ({ default: () => <div data-testid="queue-tab" /> }))
// K-193 fase 1 stand-ins — their own contracts are covered by WaWebQueueTab.test.tsx
// / ConversationsTab.test.tsx; this file stays focused on tab wiring + module gating.
vi.mock('./WaWebQueueTab', () => ({ default: () => <div data-testid="wa-web-queue-tab" /> }))
vi.mock('./ConversationsTab', () => ({ default: ({ openConversationId }: { openConversationId?: string | null }) =>
  <div data-testid="conversations-tab" data-open={openConversationId ?? ''} /> }))
// Auth gate: default closed (no whatsapp_web module, no messaging.manage) unless a
// test overrides it — mirrors the page's own optional-chained fallback.
const mockUseAuth = vi.fn<() => { hasModule: (m: string) => boolean; hasPermission: (p: string) => boolean }>(
  () => ({ hasModule: () => false, hasPermission: () => false }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/components/charts/PieChartCard', () => ({ default: () => <div data-testid="pie-chart" /> }))
vi.mock('@/components/charts/BarChartCard', () => ({ default: () => <div data-testid="bar-chart" /> }))

// Right-panel lookup options (WA-MSG-TABLE-1 stage B) — this file covers the KPI
// band + tab/filter WIRING, not the type/number/owner lookup fetches themselves
// (no QueryClientProvider in this render tree; React Query is stubbed out here).
vi.mock('./hooks/useWaFilterOptions', () => ({
  useWaMessageTypes: () => ({ data: [] }),
  useWaMessagePurposes: () => ({ data: [] }),
  useWaTemplates: () => ({ data: [] }),
  useWaPhoneNumbers: () => ({ data: [] }),
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [] }) }))

// The nine expected labels (real nl/whatsapp.json copy — @/i18n loads real resources).
const LABELS = {
  today: 'Berichten vandaag', contacted: 'Kandidaten benaderd', filled: 'Diensten gevuld via WA',
  escal: 'Open escalaties', sentToday: 'Verzonden vandaag', receivedToday: 'Ontvangen vandaag',
  queuedToday: 'In wachtrij (vandaag)', failedToday: 'Mislukt verzonden (vandaag)', noReply: 'Geëscaleerd, geen reactie',
}

// A KPI card's value, scoped to ITS card (bare digits/dashes repeat across cards).
const cardValue = (label: string) => within(screen.getByText(label).parentElement as HTMLElement)

function dataFixture(overrides: Partial<{
  stats: WaStats | null; messages: WaMessage[]; escalations: WaEscalation[]; activity: WaActivityDatum[]
  loading: Record<string, boolean>; errors: Record<string, boolean>; noConnection: boolean
}> = {}) {
  return {
    stats: null, messages: [], escalations: [], activity: [],
    loading: { stats: false, messages: false, escalations: false, activity: false },
    errors: { messages: false, escalations: false, activity: false },
    noConnection: false, reload: vi.fn(),
    loadMoreMessages: vi.fn(), loadingMoreMessages: false, messagesExhausted: false,
    ...overrides,
  }
}

// Wires the mock hook so a direction filter (drilled from a KPI click) narrows
// the fixture's own `messages` — mirroring what the real hook now does server-side.
function respondToDirectionFilter(fixture: ReturnType<typeof dataFixture>) {
  mockUseWhatsAppData.mockImplementation((filters: WaMessageFilters = {}) =>
    filters.direction?.length
      ? { ...fixture, messages: fixture.messages.filter(m => filters.direction!.includes(m.direction as string)) }
      : fixture)
}
function queueFixture(overrides: Partial<{ batches: WaQueueBatch[]; loading: boolean; error: boolean; notAvailable: boolean }> = {}) {
  return { batches: [], loading: false, error: false, notAvailable: false, reload: vi.fn(), ...overrides }
}

describe('WhatsAppPage · nine-card KPI band (WA-KPI9-1)', () => {
  it('loading state: every card renders the house dash, never a padded zero', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture({ loading: { stats: true, messages: true, escalations: true, activity: true } }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture({ loading: true }))
    render(<WhatsAppPage />)
    Object.values(LABELS).forEach(label => {
      expect(cardValue(label).getByText('—')).toBeInTheDocument()
    })
  })

  it('no-connection state: the overview tab shows the calm NoConn notice and stats-derived cards stay dashed', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture({ noConnection: true }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture({ notAvailable: true }))
    render(<WhatsAppPage />)
    expect(screen.getByText('Geen WhatsApp-verbinding')).toBeInTheDocument()
    expect(cardValue(LABELS.today).getByText('—')).toBeInTheDocument()
    expect(cardValue(LABELS.queuedToday).getByText('—')).toBeInTheDocument()
  })

  it('empty-but-successful state: real zero rows render "0", never the dash', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture({
      stats: { messages_today: 0, candidates_contacted: 0, shifts_filled_via_whatsapp: 0, open_escalations: 0 },
      escalations: [], activity: [{ date: '2026-08-14', inbound: 0, outbound: 0 }],
    }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture({ batches: [] }))
    render(<WhatsAppPage />)
    Object.values(LABELS).forEach(label => {
      expect(cardValue(label).getByText('0')).toBeInTheDocument()
    })
  })

  it('a failed derived source dashes only ITS cards — the four stats tiles keep their real numbers', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture({
      stats: { messages_today: 5, candidates_contacted: 2, shifts_filled_via_whatsapp: 1, open_escalations: 0 },
      errors: { messages: false, escalations: true, activity: true },
    }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture({ error: true }))
    render(<WhatsAppPage />)
    expect(cardValue(LABELS.today).getByText('5')).toBeInTheDocument()
    expect(cardValue(LABELS.contacted).getByText('2')).toBeInTheDocument();
    [LABELS.sentToday, LABELS.receivedToday, LABELS.queuedToday, LABELS.failedToday, LABELS.noReply].forEach(label => {
      expect(cardValue(label).getByText('—')).toBeInTheDocument()
    })
  })

  it('success state: all nine cards show the real aggregate for each source', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture({
      stats: { messages_today: 42, candidates_contacted: 15, shifts_filled_via_whatsapp: 6, open_escalations: 3 },
      escalations: [
        { candidate_id: 'c1', reason: 'no_reply', hours_waiting: 2 },
        { candidate_id: 'c2', reason: 'failed_delivery', hours_waiting: 1 },
        { candidate_id: 'c3', reason: 'no_reply', hours_waiting: 5 },
      ],
      activity: [{ date: '2026-08-13', inbound: 1, outbound: 2 }, { date: '2026-08-14', inbound: 9, outbound: 14 }],
    }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture({
      batches: [
        { batch_id: 'b1', total: 10, queued: 4, sent: 3, skipped: 1, failed: 2 },
        { batch_id: 'b2', total: 5, queued: 1, sent: 2, skipped: 0, failed: 2 },
      ],
    }))
    render(<WhatsAppPage />)
    expect(cardValue(LABELS.today).getByText('42')).toBeInTheDocument()
    expect(cardValue(LABELS.contacted).getByText('15')).toBeInTheDocument()
    expect(cardValue(LABELS.filled).getByText('6')).toBeInTheDocument()
    expect(cardValue(LABELS.escal).getByText('3')).toBeInTheDocument()
    // Today's activity entry is the LAST array item (14/9), not the first (2/1).
    expect(cardValue(LABELS.sentToday).getByText('14')).toBeInTheDocument()
    expect(cardValue(LABELS.receivedToday).getByText('9')).toBeInTheDocument()
    // queued 4+1=5, failed 2+2=4 — summed across both of today's batches.
    expect(cardValue(LABELS.queuedToday).getByText('5')).toBeInTheDocument()
    expect(cardValue(LABELS.failedToday).getByText('4')).toBeInTheDocument()
    // 2 of the 3 escalations carry reason 'no_reply'.
    expect(cardValue(LABELS.noReply).getByText('2')).toBeInTheDocument()
  })

  it('clicking "Sent today" switches to Messages and asks the hook for outbound only (WA-MSG-TABLE-1: a real server param, not a client-side slice)', async () => {
    const user = userEvent.setup()
    respondToDirectionFilter(dataFixture({
      stats: { messages_today: 2, candidates_contacted: 0, shifts_filled_via_whatsapp: 0, open_escalations: 0 },
      messages: [
        { id: 1, direction: 'outbound', status: 'delivered', sent_at: '2026-08-14T09:00:00Z' },
        { id: 2, direction: 'inbound', status: 'read', sent_at: '2026-08-14T09:05:00Z' },
        { id: 3, direction: 'outbound', status: 'failed', sent_at: '2026-08-14T09:10:00Z' },
      ],
      activity: [{ date: '2026-08-14', inbound: 1, outbound: 2 }],
    }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture())
    render(<WhatsAppPage />)
    expect(screen.getByTestId('activity-chart')).toBeInTheDocument()
    await user.click(screen.getByText(LABELS.sentToday))
    expect(mockUseWhatsAppData).toHaveBeenLastCalledWith({ direction: ['outbound'], status: [], channel: [], type: [], priority: undefined, purpose: [], template: [], owner: [], number: [], from: undefined, to: undefined, sort: 'desc' })
    expect(screen.getByTestId('messages-table')).toHaveTextContent('2') // 2 outbound of 3
    expect(screen.getByRole('tab', { name: 'Berichten' })).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking "Received today" switches to Messages and asks the hook for inbound only', async () => {
    const user = userEvent.setup()
    respondToDirectionFilter(dataFixture({
      stats: { messages_today: 2, candidates_contacted: 0, shifts_filled_via_whatsapp: 0, open_escalations: 0 },
      messages: [
        { id: 1, direction: 'outbound', status: 'delivered', sent_at: '2026-08-14T09:00:00Z' },
        { id: 2, direction: 'inbound', status: 'read', sent_at: '2026-08-14T09:05:00Z' },
      ],
      activity: [{ date: '2026-08-14', inbound: 1, outbound: 2 }],
    }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture())
    render(<WhatsAppPage />)
    await user.click(screen.getByText(LABELS.receivedToday))
    expect(mockUseWhatsAppData).toHaveBeenLastCalledWith({ direction: ['inbound'], status: [], channel: [], type: [], priority: undefined, purpose: [], template: [], owner: [], number: [], from: undefined, to: undefined, sort: 'desc' })
    expect(screen.getByTestId('messages-table')).toHaveTextContent('1') // 1 inbound of 2
  })

  it('a plain-stat card (no matching filter exists) is not interactive — no fake affordance', async () => {
    const user = userEvent.setup()
    mockUseWhatsAppData.mockReturnValue(dataFixture({
      stats: { messages_today: 0, candidates_contacted: 0, shifts_filled_via_whatsapp: 0, open_escalations: 0 },
    }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture({ batches: [{ batch_id: 'b1', total: 1, queued: 1 }] }))
    render(<WhatsAppPage />)
    const card = screen.getByText(LABELS.queuedToday).parentElement as HTMLElement
    expect(card).not.toHaveAttribute('role', 'button')
    expect(card).toHaveStyle({ cursor: 'default' })
    // Clicking it is a no-op: the overview tab (activity chart) is still showing, not Messages.
    await user.click(screen.getByText(LABELS.queuedToday))
    expect(screen.getByTestId('activity-chart')).toBeInTheDocument()
  })

  it('the legacy "Messages today" card still opens its own drill drawer (no regression from the nine-card refactor)', async () => {
    const user = userEvent.setup()
    mockUseWhatsAppData.mockReturnValue(dataFixture({
      stats: { messages_today: 7, candidates_contacted: 0, shifts_filled_via_whatsapp: 0, open_escalations: 0 },
      messages: [{ id: 1, direction: 'outbound', status: 'delivered', sent_at: '2026-08-14T09:00:00Z' }],
    }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture())
    render(<WhatsAppPage />)
    await user.click(screen.getByText(LABELS.today))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByTestId('messages-table')).toHaveTextContent('1')
  })
})

describe('WhatsAppPage · K-193 fase 1 tabs (WA-Web queue + Conversations)', () => {
  it('the WA-Web queue tab is hidden without the whatsapp_web module; Conversations always shows', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture())
    mockUseWhatsAppQueue.mockReturnValue(queueFixture())
    mockUseAuth.mockReturnValue({ hasModule: () => false, hasPermission: () => false })
    render(<WhatsAppPage />)
    expect(screen.queryByRole('tab', { name: /whatsapp web wachtrij/i })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /conversaties/i })).toBeInTheDocument()
  })

  it('the WA-Web queue tab appears with the module enabled and opens its own tab body', async () => {
    const user = userEvent.setup()
    mockUseWhatsAppData.mockReturnValue(dataFixture())
    mockUseWhatsAppQueue.mockReturnValue(queueFixture())
    mockUseAuth.mockReturnValue({ hasModule: (m: string) => m === 'whatsapp_web', hasPermission: () => false })
    render(<WhatsAppPage />)
    await user.click(screen.getByRole('tab', { name: /whatsapp web wachtrij/i }))
    expect(screen.getByTestId('wa-web-queue-tab')).toBeInTheDocument()
  })

  it('intent.tab = wa-web-queue opens directly on that tab (dashboard tile deep link)', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture())
    mockUseWhatsAppQueue.mockReturnValue(queueFixture())
    mockUseAuth.mockReturnValue({ hasModule: () => true, hasPermission: () => false })
    render(<WhatsAppPage intent={{ tab: 'wa-web-queue' }} />)
    expect(screen.getByTestId('wa-web-queue-tab')).toBeInTheDocument()
  })

  it('intent.tab = wa-web-queue with the module OFF falls back to overview instead of a blank tab body', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture())
    mockUseWhatsAppQueue.mockReturnValue(queueFixture())
    mockUseAuth.mockReturnValue({ hasModule: () => false, hasPermission: () => false })
    render(<WhatsAppPage intent={{ tab: 'wa-web-queue' }} />)
    expect(screen.queryByTestId('wa-web-queue-tab')).not.toBeInTheDocument()
    // The overview tab reads as selected — never a tab bar with nothing active.
    expect(screen.getByRole('tab', { name: /overzicht/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('intent.tab = conversations with an open id opens the tab and forwards the id', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture())
    mockUseWhatsAppQueue.mockReturnValue(queueFixture())
    mockUseAuth.mockReturnValue({ hasModule: () => false, hasPermission: () => false })
    render(<WhatsAppPage intent={{ tab: 'conversations', open: 'conv-42' }} />)
    expect(screen.getByTestId('conversations-tab')).toHaveAttribute('data-open', 'conv-42')
  })
})

describe('WhatsAppPage · per-channel overview (K-197)', () => {
  it('with by_channel on stats and activity the overview adds the channel donut and the stacked channel chart', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture({
      stats: { messages_today: 3, candidates_contacted: 1, shifts_filled_via_whatsapp: 0, open_escalations: 0,
        by_channel: [{ channel: 'waba', sent: 2, received: 1, failed: 0 }, { channel: 'waba_coex', sent: 0, received: 0, failed: 0 }, { channel: 'wa_web', sent: 0, received: 0, failed: 0 }] },
      activity: [{ date: '2026-08-25', inbound: 1, outbound: 2, by_channel: { waba: { inbound: 1, outbound: 2 } } }],
    }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture({ batches: [] }))
    render(<WhatsAppPage />)
    expect(screen.getAllByTestId('pie-chart')).toHaveLength(2)
    expect(screen.getByTestId('channel-activity-chart')).toBeInTheDocument()
  })

  it('an older envelope without by_channel keeps the two-card overview and no channel chart', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture({
      stats: { messages_today: 0, candidates_contacted: 0, shifts_filled_via_whatsapp: 0, open_escalations: 0 },
      activity: [{ date: '2026-08-25', inbound: 0, outbound: 0 }],
    }))
    mockUseWhatsAppQueue.mockReturnValue(queueFixture({ batches: [] }))
    render(<WhatsAppPage />)
    expect(screen.getAllByTestId('pie-chart')).toHaveLength(1)
    expect(screen.queryByTestId('channel-activity-chart')).not.toBeInTheDocument()
  })
})
