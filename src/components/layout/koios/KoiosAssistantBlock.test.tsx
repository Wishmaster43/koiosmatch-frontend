/**
 * KoiosAssistantBlock — flat mocks, mocked GET. Verifies server-order
 * rendering, ref deep-links via the mocked NavigationContext, the
 * empty/error states, and the action-hint chip's honest gating.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosAssistantBlock from './KoiosAssistantBlock'
import api from '@/lib/api'

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
// enabled_for_* → offered or disabled with a reason). Mutable per test, real findToolCapability.
type CapTool = { name: string; label_nl: string; confirm_required: boolean; enabled_for_me: boolean; enabled_for_tenant: boolean; default_enabled: boolean; connection_active: boolean | null; connection: null }
const capTool = (name: string, over: Partial<CapTool> = {}): CapTool =>
  ({ name, label_nl: '', confirm_required: true, enabled_for_me: true, enabled_for_tenant: true, default_enabled: true, connection_active: null, connection: null, ...over })
const DEFAULT_CAP_TOOLS: CapTool[] = [capTool('zoek_kandidaten', { label_nl: 'Kandidaten zoeken', confirm_required: false }), capTool('wijzig_taak'), capTool('maak_taak')]
let capTools: CapTool[] = DEFAULT_CAP_TOOLS
vi.mock('./useKoiosToolCapabilities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useKoiosToolCapabilities')>()),
  useKoiosToolCapabilities: () => ({ tools: capTools, isLoading: false, isError: false, capabilities: null }),
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
  capTools = DEFAULT_CAP_TOOLS
  localStorage.clear()
})

describe('KoiosAssistantBlock', () => {
  it('renders suggestion cards in the exact server order', async () => {
    givenSuggestions([
      { kind: 'task_overdue', title: 'First task', body: 'Body one', refs: [] },
      { kind: 'candidate_no_contact', title: 'Second lead', body: 'Body two', refs: [] },
    ])
    renderBlock()
    const titles = await screen.findAllByText(/First task|Second lead/)
    expect(titles.map((el) => el.textContent)).toEqual(['First task', 'Second lead'])
    expect(screen.getByText('Body one')).toBeInTheDocument()
    expect(screen.getByText('Body two')).toBeInTheDocument()
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

  // Golf 2 (contract CMBE-gepind): a parked action executes via the REAL seam.
  it('confirms a parked action via POST /ai/koios/actions/{id}/confirm and shows the executed state', async () => {
    givenSuggestions([
      { kind: 'pending_action', title: 'Parked', body: 'Ready', refs: [{ type: 'pending_action', id: 'pa-7', label: 'Parked' }] },
    ])
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /pendingAction\.confirm/ }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/pa-7/confirm'))
    await screen.findByText(/pendingAction\.confirmed/)
  })

  it('shows the SERVER message unvarnished when confirm is refused', async () => {
    givenSuggestions([
      { kind: 'pending_action', title: 'Parked', body: 'Ready', refs: [{ type: 'pending_action', id: 'pa-8', label: 'Parked' }] },
    ])
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { message: 'Uitvoering mislukt: tool niet bedraad.' } } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /pendingAction\.confirm/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Uitvoering mislukt: tool niet bedraad.')
  })

  // PRIJSMODEL-C 30-08: a declined confirm's message still renders unvarnished
  // (asserted above); the budget's upgrade_hint must ALSO surface, not be dropped.
  it('shows the upgrade hint from data.budget on a budget_exceeded decline', async () => {
    givenSuggestions([
      { kind: 'pending_action', title: 'Parked', body: 'Ready', refs: [{ type: 'pending_action', id: 'pa-10', label: 'Parked' }] },
    ])
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: {
      status: 'declined', message: 'Workflow-staffel is vol.',
      data: { budget: { state: 'blocked', allowance: 100, used: 100, upgrade_hint: { next_tier_label: 'Pro' } } },
    } } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /pendingAction\.confirm/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Workflow-staffel is vol.')
    expect(screen.getByText(/pendingAction\.upgradeHint/)).toBeInTheDocument()
  })

  it('cancel posts to /cancel and shows the cancelled state', async () => {
    givenSuggestions([
      { kind: 'pending_action', title: 'Parked', body: 'Ready', refs: [{ type: 'pending_action', id: 'pa-9', label: 'Parked' }] },
    ])
    mockPost.mockResolvedValueOnce({ data: { status: 'cancelled' } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /pendingAction\.cancel/ }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/pa-9/cancel'))
    await screen.findByText(/pendingAction\.cancelled/)
  })

  it('a descriptor kind hands off to the chat: prefills via onAskKoios, never an API call', async () => {
    givenSuggestions([
      { kind: 'task_overdue', title: 'Bel Ahmed terug', body: 'Taak verlopen', refs: [], action: { tool: 'wijzig_taak', input: {} } },
    ])
    const onAskKoios = vi.fn()
    renderBlock({ onAskKoios })
    fireEvent.click(await screen.findByRole('button', { name: /assistant\.askKoios/ }))
    expect(onAskKoios).toHaveBeenCalledTimes(1)
    // Uninitialised i18n echoes the key here; the REAL interpolation ("Help me
    // hiermee: {{title}}") is pinned in src/i18n/c1AssistantKeys.test.ts.
    expect(onAskKoios.mock.calls[0][0]).toBe('koios.assistant.askIntent')
    // The handoff carries the suggestion's record refs so Koios knows WHO (Danny 09-09).
    expect(onAskKoios.mock.calls[0][1]).toEqual(expect.any(Array))
    expect(mockPost).not.toHaveBeenCalled()
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
    await screen.findByText(/pendingAction\.confirmed/)
    // The next fetch returns a DIFFERENT parked action in the same slot.
    givenSuggestions([
      { kind: 'pending_action', title: 'Tweede', body: 'b', refs: [{ type: 'pending_action', id: 'pa-y', label: 'Tweede' }] },
    ])
    await client.refetchQueries({ queryKey: ['koios', 'assistant'] })
    await screen.findAllByText('Tweede')
    expect(screen.getByRole('button', { name: /pendingAction\.confirm/ })).toBeInTheDocument()
    expect(screen.queryByText(/pendingAction\.confirmed/)).toBeNull()
  })

  // SERVER truth beats HTTP truth: a 200 whose status is not the verdict errors honestly.
  it('a 200 without status=executed lands in the error branch with the server message', async () => {
    givenSuggestions([
      { kind: 'pending_action', title: 'Parked', body: 'x', refs: [{ type: 'pending_action', id: 'pa-z', label: 'Parked' }] },
    ])
    mockPost.mockResolvedValueOnce({ data: { status: 'failed', message: 'tool niet bedraad' } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /pendingAction\.confirm/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('tool niet bedraad')
    expect(screen.queryByText(/pendingAction\.confirmed/)).toBeNull()
  })

  it('a parked action WITHOUT its pending_action ref stages like any descriptor (golf 3)', async () => {
    givenSuggestions([
      { kind: 'pending_action', title: 'Old BE', body: 'No ref', refs: [], action: { tool: 'x', input: {} } },
    ])
    renderBlock()
    await screen.findByText('Old BE')
    expect(screen.getByRole('button', { name: /assistant\.execute/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pendingAction\.confirm/ })).toBeNull()
  })

  // Golf 3: one-click staging — Uitvoeren parks {tool,input}, the preview + the
  // REAL confirm follow on the card; nothing executes before Bevestigen.
  it('Uitvoeren stages the descriptor, shows the preview and confirms with the staged id', async () => {
    givenSuggestions([
      { kind: 'task_overdue', title: 'Bel Ahmed', body: 'x', refs: [], action: { tool: 'wijzig_taak', input: { task_id: 't1' } } },
    ])
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-77', title: 'Bel Ahmed', preview: [{ label: 'Deadline', before: '26-08-2026', after: '28-08-2026' }] } } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /assistant\.execute/ }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/stage', { tool: 'wijzig_taak', input: { task_id: 't1' } }))
    await screen.findByText(/Deadline · 26-08-2026 → 28-08-2026/)
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    fireEvent.click(screen.getByRole('button', { name: /pendingAction\.confirm/ }))
    await waitFor(() => expect(mockPost).toHaveBeenLastCalledWith('/ai/koios/actions/pa-77/confirm'))
    await screen.findByText(/pendingAction\.confirmed/)
  })

  it('a refused stage (403) shows the server message and executes nothing', async () => {
    givenSuggestions([
      { kind: 'task_overdue', title: 'Bel Ahmed', body: 'x', refs: [], action: { tool: 'wijzig_taak', input: {} } },
    ])
    mockPost.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Je mag deze tool niet uitvoeren.' } } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /assistant\.execute/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Je mag deze tool niet uitvoeren.')
    expect(mockPost).toHaveBeenCalledTimes(1)
  })
})

// Danny 09-09 (live review, evening): compact rows with ONE face for the chat handoff,
// the created record linked after a confirm, and raw id rows kept out of the preview.
describe('KoiosAssistantBlock · Danny 09-09 row behaviour', () => {
  it('a suggestion without any action still offers the SAME chat handoff button (never a filled variant)', async () => {
    givenSuggestions([
      { kind: 'opportunity_closing_soon', title: 'Uitbreiding flexpool', body: 'Kans sluit over 8 dagen.', refs: [{ type: 'opportunity', id: 'o1', label: 'Uitbreiding flexpool' }], action: null },
      { kind: 'candidate_no_contact', title: 'Sanne Kuipers', body: 'Bel Sanne Kuipers: 382 dagen geen contact.', refs: [{ type: 'candidate', id: 'c1', label: 'Sanne Kuipers' }], action: { tool: 'maak_taak', input: { titel: 'Bel Sanne Kuipers', kandidaat_id: 'c1' } } },
    ])
    const onAskKoios = vi.fn()
    renderBlock({ onAskKoios })
    const chatButtons = await screen.findAllByRole('button', { name: /assistant\.askKoios/ })
    expect(chatButtons).toHaveLength(2)
    // Only the executable row carries Uitvoeren.
    expect(screen.getAllByRole('button', { name: /assistant\.execute/ })).toHaveLength(1)
    // The handoff carries the record ref (WHO) and the reason (WHY) through the body key.
    fireEvent.click(chatButtons[1])
    expect(onAskKoios).toHaveBeenCalledWith('koios.assistant.askIntent', [{ type: 'candidate', id: 'c1', label: 'Sanne Kuipers' }])
  })

  it('a confirmed maak_taak shows the created task as a deep-link chip and hides raw id rows from the preview', async () => {
    givenSuggestions([
      { kind: 'candidate_no_contact', title: 'Sem Timmermans', body: 'Bel Sem Timmermans: 181 dagen geen contact.', refs: [{ type: 'candidate', id: 'c2', label: 'Sem Timmermans' }], action: { tool: 'maak_taak', input: { titel: 'Bel Sem Timmermans', kandidaat_id: 'c2' } } },
    ])
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-9', title: 'Bel Sem Timmermans', preview: [{ label: 'titel', text: 'Bel Sem Timmermans' }, { label: 'kandidaat_id', text: '9120a898-9e4c-40cb-896e-295c04a6baef' }] } } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /assistant\.execute/ }))
    await screen.findByText(/titel: Bel Sem Timmermans/)
    expect(screen.queryByText(/9120a898/)).toBeNull()
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: { gelukt: true, taak_id: 't-55', titel: 'Bel Sem Timmermans' } } })
    fireEvent.click(screen.getByRole('button', { name: /pendingAction\.confirm/ }))
    await screen.findByText(/pendingAction\.confirmed/)
    // The created task is a real chip: clicking it deep-links to the task drawer.
    const taskChips = screen.getAllByRole('button', { name: /Bel Sem Timmermans/ })
    fireEvent.click(taskChips[taskChips.length - 1])
    expect(openEntity).toHaveBeenCalledWith('tasks', 't-55')
  })
})

// Danny 10-09 (live review, Kelly's panel): one click where the registry needs no confirm,
// the landing after an executed search, an honest disabled state, and the refetch after.
describe('KoiosAssistantBlock · KOIOS-ROW-2', () => {
  const vacancyRow = { kind: 'vacancy_zero_applications', title: 'Verzorgende IG | Amsterdam', body: 'Vacature "Verzorgende IG | Amsterdam" heeft nog geen kandidaten. Zoeken?', refs: [{ type: 'vacancy', id: 'v1', label: 'Verzorgende IG | Amsterdam' }], action: { tool: 'zoek_kandidaten', input: { vacature_id: 'v1' } } }

  it('Uitvoeren executes in ONE click when the tool needs no confirm, then opens the vacancy on its candidate-search tab', async () => {
    givenSuggestions([vacancyRow])
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-1', title: 'Kandidaten zoeken', preview: [{ label: 'functie', text: 'Verzorgende IG' }] } } })
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: { gelukt: true } } })
    renderBlock()
    // The button says what it does: the registry's own tool name, not a bare "Uitvoeren".
    fireEvent.click(await screen.findByRole('button', { name: 'Kandidaten zoeken' }))
    await screen.findByText(/pendingAction\.confirmed/)
    expect(mockPost).toHaveBeenNthCalledWith(1, '/ai/koios/actions/stage', { tool: 'zoek_kandidaten', input: { vacature_id: 'v1' } })
    expect(mockPost).toHaveBeenNthCalledWith(2, '/ai/koios/actions/pa-1/confirm')
    // No second Bevestigen step, and the user lands on the record.
    expect(screen.queryByRole('button', { name: /pendingAction\.confirm$/ })).toBeNull()
    expect(openEntity).toHaveBeenCalledWith('vacancies', 'v1', 'candidateSearch')
    // The list reads the server again after the action.
    await waitFor(() => expect(mockGet.mock.calls.filter(c => c[0] === '/ai/koios/assistant').length).toBeGreaterThanOrEqual(2))
  })

  it("the confirm response's own navigate hint wins over the tool's follow-up", async () => {
    givenSuggestions([vacancyRow])
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-2', title: 'Kandidaten zoeken', preview: [] } } })
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: { navigate: { type: 'candidate', id: 'c9', tab: 'communication' } } } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: 'Kandidaten zoeken' }))
    await screen.findByText(/pendingAction\.confirmed/)
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c9', 'communication')
  })

  it('a confirm_required tool keeps the preview + Bevestigen step', async () => {
    givenSuggestions([{ kind: 'task_overdue', title: 'Bel Ahmed', body: 'x', refs: [], action: { tool: 'wijzig_taak', input: { task_id: 't1' } } }])
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-3', title: 'Bel Ahmed', preview: [{ label: 'Deadline', before: '26-08-2026', after: '28-08-2026' }] } } })
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: /assistant\.execute/ }))
    await screen.findByText(/Deadline · 26-08-2026 → 28-08-2026/)
    expect(screen.getByRole('button', { name: /pendingAction\.confirm$/ })).toBeInTheDocument()
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('a tool switched off for the organisation or for this user gets no Uitvoeren at all; the chat handoff stays', async () => {
    capTools = [capTool('maak_taak', { enabled_for_tenant: false }), capTool('wijzig_taak', { enabled_for_me: false })]
    givenSuggestions([
      { kind: 'candidate_no_contact', title: 'Sanne Kuipers', body: 'Bel Sanne Kuipers: 382 dagen geen contact.', refs: [{ type: 'candidate', id: 'c1', label: 'Sanne Kuipers' }], action: { tool: 'maak_taak', input: {} } },
      { kind: 'task_overdue', title: 'Bel Ahmed', body: 'x', refs: [], action: { tool: 'wijzig_taak', input: {} } },
    ])
    const onAskKoios = vi.fn()
    renderBlock({ onAskKoios })
    expect(await screen.findAllByRole('button', { name: /assistant\.askKoios/ })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /assistant\.execute/ })).toBeNull()
    expect(screen.queryByText(/disabledFor/)).toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('a no-contact row carries the message icon to the person\'s Communicatie tab without any contact data', async () => {
    givenSuggestions([{ kind: 'candidate_no_contact', title: 'Sanne Kuipers', body: 'Bel Sanne Kuipers: 382 dagen geen contact.', refs: [{ type: 'candidate', id: 'c1', label: 'Sanne Kuipers' }], action: { tool: 'maak_taak', input: {} } }])
    renderBlock()
    fireEvent.click(await screen.findByRole('button', { name: 'koios.assistant.message' }))
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c1', 'communication')
    expect(screen.queryByRole('link', { name: 'koios.assistant.call' })).toBeNull()
  })
})

// KOIOS-PANEL-2 pre-adoption (tolerant): a row's actions[] — the first is the button, the
// rest sit in the row menu — and the person's contact channels as three icons.
describe('KoiosAssistantBlock · KOIOS-PANEL-2 envelope', () => {
  it('renders the first action as the button (its label), the rest behind the row menu, and stages the picked one', async () => {
    givenSuggestions([{ kind: 'task_overdue', title: 'Lieke Groen bellen', body: 'Taak is 609 dagen over tijd.', refs: [{ type: 'task', id: 't1', label: 'Lieke Groen bellen' }],
      actions: [{ tool: 'wijzig_taak', label: 'Verzetten', args: { task_id: 't1' }, preview: [{ label: 'Deadline', before: '01-01-2025', after: '17-09-2026' }] }, { tool: 'maak_taak', label: 'Bellen', args: { titel: 'Bel Lieke' } }] }])
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-5', title: 'Bel Lieke', preview: [] } } })
    renderBlock()
    const primaryBtn = await screen.findByRole('button', { name: 'Verzetten' })
    expect(primaryBtn).toHaveAttribute('title', 'Deadline · 01-01-2025 → 17-09-2026')
    expect(screen.queryByRole('button', { name: /assistant\.execute/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.moreActions' }))
    fireEvent.click(await screen.findByText('Bellen'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/stage', { tool: 'maak_taak', input: { titel: 'Bel Lieke' } }))
  })

  it('shows call, mail and message icons when the candidate ref carries contact channels', async () => {
    givenSuggestions([{ kind: 'candidate_no_contact', title: 'Youssef Postma', body: 'Bel Youssef Postma: 186 dagen geen contact.',
      refs: [{ type: 'candidate', id: 'c7', label: 'Youssef Postma', contact: { mobile: '+31612345678', email: 'youssef@example.test' } }], action: null }])
    renderBlock()
    expect(await screen.findByRole('link', { name: 'koios.assistant.call' })).toHaveAttribute('href', 'tel:+31612345678')
    expect(screen.getByRole('link', { name: 'koios.assistant.email' })).toHaveAttribute('href', 'mailto:youssef@example.test')
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.message' }))
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c7', 'communication')
  })
})
