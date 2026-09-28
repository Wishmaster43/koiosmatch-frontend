/**
 * KoiosAssistantBlock — flat mocks, mocked GET. Verifies server-order
 * rendering, ref deep-links via the mocked NavigationContext, and the four
 * explicit UI states (loading/error/empty/success). Per-row rendering (icon,
 * short reason, icon-button actions, staged/confirm leg) moved to
 * `KoiosSuggestionRow.test.tsx` (KOIOS-SUGGEST-COMPACT-1, 24-09) — this suite
 * stays a thin list-container test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosAssistantBlock from './KoiosAssistantBlock'
import api from '@/lib/api'
import { notifySuccess } from '@/lib/notify'

// KOIOS-SUGGEST-COMPACT-2 (Danny 28-09: "Create taak annuleren en blijft staan, geen
// auto refresh"): the toast is the visible feedback once a row resolves — spy on it
// instead of re-implementing the notify event plumbing here.
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notify: vi.fn() }))
const mockNotifySuccess = notifySuccess as unknown as ReturnType<typeof vi.fn>

// GET /ai/koios/assistant + the golf-2 confirm/cancel POSTs — all mocked (API-CREDITS-1).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

// lib/formatters re-exports datetime's useLocale at module scope (DATETIME-IMPORT-LES,
// see KoiosResultCards -> @/lib/formatters); this suite asserts raw i18n keys under an
// uninitialised i18next instance, so real i18n resources would break those assertions.
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))

// openEntity spy for the ref deep-link assertion (KoiosResultCards reads useNavigation()).
const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

// KOIOS-ROW-2: the tool registry's word per tool (confirm_required → one click or two,
// enabled_for_* → offered or disabled with a reason). Real findToolCapability.
type CapTool = { name: string; label_nl: string; confirm_required: boolean; enabled_for_me: boolean; enabled_for_tenant: boolean; default_enabled: boolean; connection_active: boolean | null; connection: null }
const capTool = (name: string, over: Partial<CapTool> = {}): CapTool =>
  ({ name, label_nl: '', confirm_required: true, enabled_for_me: true, enabled_for_tenant: true, default_enabled: true, connection_active: null, connection: null, ...over })
vi.mock('./useKoiosToolCapabilities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useKoiosToolCapabilities')>()),
  useKoiosToolCapabilities: () => ({ tools: [capTool('wijzig_taak'), capTool('maak_taak')], isLoading: false, isError: false, capabilities: null }),
}))

// The assistant list as a PERSISTENT answer (the block refetches after an executed or
// cancelled action, so a one-shot value would leave the refetch unmocked).
const givenSuggestions = (suggestions: unknown[]) =>
  mockGet.mockImplementation((url: string) => url === '/ai/koios/assistant'
    ? Promise.resolve({ data: { data: { suggestions } } })
    : Promise.reject(new Error(`unmocked GET ${url}`)))

// Fresh QueryClient per test so cache never leaks between cases.
function renderBlock(props: { onAskKoios?: (text: string) => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><KoiosAssistantBlock {...props} /></QueryClientProvider>)
}

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  openEntity.mockReset()
  mockNotifySuccess.mockReset()
  localStorage.clear()
})

describe('KoiosAssistantBlock', () => {
  it('renders suggestion rows in the exact server order', async () => {
    givenSuggestions([
      { kind: 'task_overdue', title: 'First task', body: 'Body one', refs: [] },
      { kind: 'candidate_no_contact', title: 'Second lead', body: 'Body two', refs: [] },
    ])
    renderBlock()
    const titles = await screen.findAllByText(/First task|Second lead/)
    expect(titles.map((el) => el.textContent)).toEqual(['First task', 'Second lead'])
  })

  it('deep-links a suggestion ref via openEntity', async () => {
    givenSuggestions([
      { kind: 'pending_action', title: 'Follow up', body: 'Do it', refs: [{ type: 'candidate', id: '42', label: 'Jane Doe' }] },
    ])
    renderBlock()
    const card = await screen.findByText('Jane Doe')
    fireEvent.click(card)
    expect(openEntity).toHaveBeenCalledWith('candidates', '42')
  })

  it('shows the empty state when there are zero suggestions', async () => {
    givenSuggestions([])
    renderBlock()
    expect(await screen.findByText('koios.assistant.emptyState')).toBeInTheDocument()
  })

  it('shows a subtle error with retry, and retry refetches', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'))
    givenSuggestions([])
    renderBlock()
    await screen.findByText('error.body')
    fireEvent.click(screen.getByText('error.retry'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    // The SEAM, not just the count (§13): both calls hit the K-148 route.
    expect(mockGet).toHaveBeenNthCalledWith(1, '/ai/koios/assistant')
    expect(mockGet).toHaveBeenNthCalledWith(2, '/ai/koios/assistant')
  })

  // Golf 2 (contract CMBE-gepind), extended by KOIOS-SUGGEST-COMPACT-2 (Danny 28-09:
  // "Create taak annuleren en blijft staan, geen auto refresh"): a parked action
  // executes via the REAL seam, the row leaves the list immediately (never lingers
  // with the "confirmed" text), a toast confirms, and the list + "for you" refetch fire.
  it('confirms a parked action, drops the row immediately, toasts and refetches', async () => {
    givenSuggestions([
      { kind: 'pending_action', title: 'Parked', body: 'Ready', refs: [{ type: 'pending_action', id: 'pa-7', label: 'Parked' }] },
    ])
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /pendingAction\.confirm/ }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/pa-7/confirm'))
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('koios.assistant.doneExecuted'))
    // No lingering "Cancelled."/"Executed." row — it is dropped, not left in a terminal state.
    await waitFor(() => expect(screen.queryByText('Parked')).toBeNull())
    await waitFor(() => expect(mockGet.mock.calls.filter(c => c[0] === '/ai/koios/assistant').length).toBeGreaterThanOrEqual(2))
  })

  // Regression for the Opus golf-2 blocker: terminal state may NEVER survive a
  // list swap onto a DIFFERENT action — stable identity keys remount the row.
  it('a refetch that swaps in a different parked action shows live buttons, never the previous verdict', async () => {
    givenSuggestions([
      { kind: 'pending_action', title: 'Eerste', body: 'a', refs: [{ type: 'pending_action', id: 'pa-x', label: 'Eerste' }] },
    ])
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><KoiosAssistantBlock /></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', { name: /pendingAction\.confirm/ }))
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalledWith('koios.assistant.doneExecuted'))
    // The next fetch returns a DIFFERENT parked action in the same slot.
    givenSuggestions([
      { kind: 'pending_action', title: 'Tweede', body: 'b', refs: [{ type: 'pending_action', id: 'pa-y', label: 'Tweede' }] },
    ])
    await client.refetchQueries({ queryKey: ['koios', 'assistant'] })
    await screen.findAllByText('Tweede')
    expect(screen.getByRole('button', { name: /pendingAction\.confirm/ })).toBeInTheDocument()
    expect(screen.queryByText(/pendingAction\.confirmed/)).toBeNull()
  })

  // A suggestion the refetched list still returns reappears after the grace window
  // (KOIOS-SUGGEST-COMPACT-2): the server is the truth, the dismiss is only a
  // brief window so the row never lingers with stale terminal text.
  it('a suggestion the refetch still returns reappears after the grace window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    givenSuggestions([
      { kind: 'pending_action', title: 'Nog steeds', body: 'a', refs: [{ type: 'pending_action', id: 'pa-z', label: 'Nog steeds' }] },
    ])
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /pendingAction\.confirm/ }))
    await waitFor(() => expect(mockNotifySuccess).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Nog steeds')).toBeNull())
    await vi.advanceTimersByTimeAsync(1600)
    // The server still lists it (the action confirm is unrelated to the suggestion feed
    // in this fixture): it comes back, with fresh live buttons.
    await waitFor(() => expect(screen.getAllByText('Nog steeds').length).toBeGreaterThan(0))
    vi.useRealTimers()
  })

  it('a descriptor kind hands off to the chat: prefills via onAskKoios, never an API call', async () => {
    givenSuggestions([
      { kind: 'task_overdue', title: 'Bel Ahmed terug', body: 'Taak verlopen', refs: [], action: { tool: 'wijzig_taak', input: {} } },
    ])
    const onAskKoios = vi.fn()
    renderBlock({ onAskKoios })
    fireEvent.click(await screen.findByRole('button', { name: /assistant\.askKoios/ }))
    expect(onAskKoios).toHaveBeenCalledTimes(1)
    // Uninitialised i18n echoes the key here; the REAL interpolation is pinned in c1AssistantKeys.test.ts.
    expect(onAskKoios.mock.calls[0][0]).toBe('koios.assistant.askIntent')
    // The handoff carries the suggestion's record refs so Koios knows WHO (Danny 09-09).
    expect(onAskKoios.mock.calls[0][1]).toEqual(expect.any(Array))
    expect(mockPost).not.toHaveBeenCalled()
  })
})
