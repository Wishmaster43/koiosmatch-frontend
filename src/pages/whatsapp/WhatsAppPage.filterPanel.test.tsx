/**
 * WhatsAppPage · right-panel filter registration (WA-MSG-TABLE-1 stage B, K-194).
 * Pins: (1) every K-194 axis registers as its own right-panel group key
 * (§3A — never a toolbar control); (2) a table type-chip click (messageColumns
 * onFilter) sets the SAME type group state the panel reads, and that reaches
 * the data hook as a real request param; (3) a date-range change reaches
 * from/to on the same hook call.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import WhatsAppPage from './WhatsAppPage'
import type { WaMessageFilters } from './hooks/useWhatsAppData'

// Captures every registerFilters call so the test can inspect the REAL group
// config the page builds, and drive a pick through the same onToggle/onFromChange
// a right-panel row would call — mirrors MatchesPage.filterPanel.test.tsx.
interface FilterGroup { key: string; selected?: string[]; noChip?: boolean; onToggle?: (v: string) => void; onFromChange?: (v: string) => void; onToChange?: (v: string) => void }
let lastGroups: FilterGroup[] = []
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({
    registerFilters: (_key: string, groups: FilterGroup[]) => { lastGroups = groups },
    unregisterFilters: () => {},
  }),
}))

const mockUseWhatsAppData = vi.fn()
vi.mock('./hooks/useWhatsAppData', () => ({ useWhatsAppData: (filters?: WaMessageFilters) => mockUseWhatsAppData(filters) }))

const mockUseWhatsAppQueue = vi.fn()
vi.mock('./hooks/useWhatsAppQueue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hooks/useWhatsAppQueue')>()
  return { ...actual, useWhatsAppQueue: () => mockUseWhatsAppQueue() }
})

// One tenant message type (id 7) so the type-chip gateway has something to click.
// eslint-disable-next-line no-restricted-syntax -- test fixture DATA (a seeded tenant message-type colour), not a UI style
vi.mock('@/hooks/useWaMessageTypes', () => ({ useWaMessageTypes: () => ({ data: [{ id: 7, value: 'reminder', label: 'Herinnering', color: '#4f46e5', is_priority: false }] }) }))
vi.mock('./hooks/useWaFilterOptions', () => ({
  useWaMessagePurposes: () => ({ data: [{ value: 'manual', label: 'Manual' }] }),
  useWaTemplates: () => ({ data: [{ value: 'welcome_template', label: 'welcome_template' }] }),
  useWaPhoneNumbers: () => ({ data: [{ value: 'pn1', label: '+31 6 1234 5678' }] }),
}))
vi.mock('@/lib/queries', () => ({ useUsers: () => ({ data: [{ id: 'u1', name: 'Jane' }] }) }))

vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity: vi.fn() }) }))
vi.mock('./components', () => ({ EscalationList: () => <div />, ActivityChart: () => <div /> }))
vi.mock('./QueueTab', () => ({ default: () => <div /> }))
vi.mock('@/components/charts/PieChartCard', () => ({ default: () => <div /> }))
vi.mock('@/components/charts/BarChartCard', () => ({ default: () => <div /> }))

afterEach(() => vi.clearAllMocks())

function dataFixture(overrides: Record<string, unknown> = {}) {
  return {
    stats: null, messages: [{ id: 'm-1', direction: 'outbound', template_name: 'welcome', sent_at: '2026-08-20T09:00:00Z' }],
    escalations: [], activity: [],
    loading: { stats: false, messages: false, escalations: false, activity: false },
    errors: { messages: false, escalations: false, activity: false },
    noConnection: false, reload: vi.fn(),
    loadMoreMessages: vi.fn(), loadingMoreMessages: false, messagesExhausted: false,
    ...overrides,
  }
}

describe('WhatsAppPage · right-panel filter groups (WA-MSG-TABLE-1 stage B)', () => {
  it('registers every K-194 axis as its own group key', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture())
    mockUseWhatsAppQueue.mockReturnValue({ batches: [], loading: false, error: false, notAvailable: false, reload: vi.fn() })
    render(<WhatsAppPage />)
    const keys = lastGroups.map(g => g.key)
    expect(keys).toEqual(expect.arrayContaining([
      'status', 'direction', 'channel', 'type', 'priority', 'purpose', 'owner', 'number', 'dateRange', 'sort',
    ]))
  })

  it('the type filter (set via the panel group, same setter a table chip click uses) reaches the request as type[]', async () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture())
    mockUseWhatsAppQueue.mockReturnValue({ batches: [], loading: false, error: false, notAvailable: false, reload: vi.fn() })
    render(<WhatsAppPage />)
    const typeGroup = lastGroups.find(g => g.key === 'type')!
    act(() => { typeGroup.onToggle!('7') })
    await waitFor(() => expect(mockUseWhatsAppData).toHaveBeenLastCalledWith(expect.objectContaining({ type: ['7'] })))
  })

  it('a date-range change reaches the hook as from/to', async () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture())
    mockUseWhatsAppQueue.mockReturnValue({ batches: [], loading: false, error: false, notAvailable: false, reload: vi.fn() })
    render(<WhatsAppPage />)
    // Re-read the group after each act — the page re-renders with a fresh
    // dateRange closure, exactly like a real right-panel click would see.
    act(() => { lastGroups.find(g => g.key === 'dateRange')!.onFromChange!('2026-08-01') })
    act(() => { lastGroups.find(g => g.key === 'dateRange')!.onToChange!('2026-08-31') })
    await waitFor(() => expect(mockUseWhatsAppData).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-08-01', to: '2026-08-31' }),
    ))
  })

  // BLOCKER FIX: sort always carries a value (desc by default) — without
  // noChip the topbar filter badge and the panel's chip row would falsely
  // read "1 filter active" with nothing actually filtered, and their remove
  // controls would be dead (§0 no fake affordances).
  it('the sort group never renders as an active filter chip (noChip)', () => {
    mockUseWhatsAppData.mockReturnValue(dataFixture())
    mockUseWhatsAppQueue.mockReturnValue({ batches: [], loading: false, error: false, notAvailable: false, reload: vi.fn() })
    render(<WhatsAppPage />)
    const sortGroup = lastGroups.find(g => g.key === 'sort')!
    expect(sortGroup.noChip).toBe(true)
    expect(sortGroup.selected).toEqual(['desc'])
  })

  // BLOCKER FIX: the server cursor only pages backward — with sort=asc the
  // Messages tab must not offer "load more" (it would append older rows below
  // an ascending list and can never reach recent ones).
  it('disables load-more on the Messages tab once sort=asc', async () => {
    const user = userEvent.setup()
    mockUseWhatsAppData.mockReturnValue(dataFixture({ messagesExhausted: false }))
    mockUseWhatsAppQueue.mockReturnValue({ batches: [], loading: false, error: false, notAvailable: false, reload: vi.fn() })
    render(<WhatsAppPage />)
    await user.click(screen.getByRole('tab', { name: 'Berichten' }))
    expect(screen.getByRole('button', { name: /meer laden/i })).toBeInTheDocument()
    act(() => { lastGroups.find(g => g.key === 'sort')!.onToggle!('asc') })
    expect(screen.queryByRole('button', { name: /meer laden/i })).not.toBeInTheDocument()
    expect(screen.getByText(/geen oudere berichten/i)).toBeInTheDocument()
  })
})

// CEL-DOORKLIK-CANON: a type/template chip in the Messages tab table sets the
// SAME panel filter state — never a second, disagreeing filter mechanism.
describe('WhatsAppPage · table chip → panel filter gateway', () => {
  it('clicking a message-type chip in the table sets the panel type filter', async () => {
    const user = userEvent.setup()
    mockUseWhatsAppData.mockReturnValue(dataFixture({
      messages: [{ id: 'm-1', direction: 'outbound', sent_at: '2026-08-20T09:00:00Z',
        // eslint-disable-next-line no-restricted-syntax -- test fixture DATA (a seeded tenant message-type colour), not a UI style
        message_type: { id: 7, value: 'reminder', label: 'Herinnering', color: '#4f46e5' } }],
    }))
    mockUseWhatsAppQueue.mockReturnValue({ batches: [], loading: false, error: false, notAvailable: false, reload: vi.fn() })
    render(<WhatsAppPage />)
    await user.click(screen.getByRole('tab', { name: 'Berichten' }))
    await user.click(screen.getByText('Herinnering'))
    await waitFor(() => expect(mockUseWhatsAppData).toHaveBeenLastCalledWith(expect.objectContaining({ type: ['7'] })))
  })
})
