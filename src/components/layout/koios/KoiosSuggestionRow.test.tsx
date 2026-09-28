/**
 * KoiosSuggestionRow — flat mocks (mirrors KoiosAssistantBlock.test.tsx). Pins
 * the short-reason rendering (never the server's Dutch body), the icon-button
 * actions with a `koios.assistant.actions.*`/`koios.tools.*` accessible name
 * (CMBE addendum 28-09 action shape `{key,tool,input,label_key,tool_label_key}`),
 * contact channels, and the staged/confirm leg moved verbatim from the old
 * KoiosAssistantBlock suite. `t()` here echoes its OWN key verbatim, ignoring
 * `defaultValue` — real i18next's normal "unresolved + defaultValue → the
 * default" behaviour would otherwise collapse `toolLabel`'s two-level
 * label_key → tool_label_key → NL-label fallback chain to its deepest term
 * for every action, making the PRIORITY unobservable under the rest of this
 * suite's plain uninitialised-i18n convention. The REAL resolved copy (which
 * key actually wins once resources are loaded) is pinned in
 * `src/i18n/c1AssistantKeys.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import KoiosSuggestionRow from './KoiosSuggestionRow'
import api from '@/lib/api'

// The golf-2 confirm/cancel POSTs — all mocked (API-CREDITS-1).
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

// See file header: `t` echoes its key, ignoring `defaultValue`, so a nested
// fallback chain's PRIORITY (which key wins) is directly observable here.
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}))

// lib/formatters re-exports datetime's useLocale at module scope (DATETIME-IMPORT-LES);
// this suite asserts raw i18n keys under an uninitialised i18next instance.
vi.mock('@/lib/formatters', () => ({ useNumberFormat: () => ({ formatNumber: (n: number) => String(n) }) }))

const openEntity = vi.fn()
vi.mock('@/context/NavigationContext', () => ({ useNavigation: () => ({ openEntity, navigate: vi.fn() }) }))

type CapTool = { name: string; label_nl: string; confirm_required: boolean; enabled_for_me: boolean; enabled_for_tenant: boolean; default_enabled: boolean; connection_active: boolean | null; connection: null }
const capTool = (name: string, over: Partial<CapTool> = {}): CapTool =>
  ({ name, label_nl: '', confirm_required: true, enabled_for_me: true, enabled_for_tenant: true, default_enabled: true, connection_active: null, connection: null, ...over })
let capTools: CapTool[] = [capTool('zoek_kandidaten', { confirm_required: false }), capTool('wijzig_taak'), capTool('maak_taak'), capTool('stuur_whatsapp')]
vi.mock('./useKoiosToolCapabilities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useKoiosToolCapabilities')>()),
  useKoiosToolCapabilities: () => ({ tools: capTools, isLoading: false, isError: false, capabilities: null }),
}))

beforeEach(() => {
  mockPost.mockReset()
  openEntity.mockReset()
  capTools = [capTool('zoek_kandidaten', { confirm_required: false }), capTool('wijzig_taak'), capTool('maak_taak'), capTool('stuur_whatsapp')]
})

describe('KoiosSuggestionRow · short reason (KOIOS-SUGGEST-COMPACT-1)', () => {
  it('renders the typed reason key + count when `params` is present, and its own task-type icon+colour — never the server body', () => {
    // A fixture task-type colour — a token string, like a real tenant lookup row
    // would carry, so this needs no ad-hoc-hex lint exception (huisstijl ceiling).
    const fixtureColor = 'var(--color-success)'
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Bel Ahmed', body: 'Taak "Bel Ahmed terug" is 4 dagen over tijd.', refs: [],
      params: { days_overdue: 4, task_type: { icon: 'phone', color: fixtureColor, label: 'Belafspraak' } },
    }
    const { container } = render(<KoiosSuggestionRow suggestion={suggestion} />)
    // The reason line asks the i18n key with the count — never the raw NL body text as visible content.
    expect(screen.getByText('koios.assistant.reason.task_overdue')).toBeInTheDocument()
    expect(screen.queryByText(suggestion.body)).toBeNull()
    // The body still rides along as the row's tooltip (title attribute).
    expect(screen.getByTitle(suggestion.body)).toBeInTheDocument()
    // The task type's OWN colour drives the icon slot (Danny 24-09) — never the kind default.
    const iconSlot = container.querySelectorAll('span')[0]
    expect(iconSlot).toHaveStyle({ color: fixtureColor })
  })

  it('falls back to the short kind label when `params` is absent (BE half not landed yet)', () => {
    const suggestion = { kind: 'candidate_no_contact' as const, title: 'Sanne', body: 'Bel Sanne: 382 dagen geen contact.', refs: [] }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.getByText('koios.assistant.reasonShort.candidate_no_contact')).toBeInTheDocument()
    expect(screen.queryByText(suggestion.body)).toBeNull()
  })
})

describe('KoiosSuggestionRow · icon-button actions (CMBE addendum action shape)', () => {
  // Under this suite's `t(key) => key` stub (see file header), a fixture with a
  // real `label` and no `label_key`/`tool_label_key` proves the icon+action
  // plumbing without exercising the fallback chain's priority; the chain's
  // ORDER (label_key > tool_label_key > NL label) is proven below with the real
  // BE action shape, and the REAL resolved copy is pinned with real i18n in
  // `src/i18n/c1AssistantKeys.test.ts` (SCHERMWAARHEID-1).
  it('every action renders as its own icon button, in order, with its NL label as the accessible name', () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Lieke', body: 'x', refs: [{ type: 'task', id: 't1', label: 'Lieke' }],
      actions: [
        { key: 'complete_task', tool: 'wijzig_taak', input: {}, label: 'Afronden' },
        { key: 'reschedule_task', tool: 'wijzig_taak', input: {}, label: 'Verzetten' },
      ],
    }
    const { container } = render(<KoiosSuggestionRow suggestion={suggestion} />)
    // Primary (first) action.
    expect(screen.getByRole('button', { name: 'Afronden' })).toBeInTheDocument()
    // Second action, rendered inline (two actions + chat icon stays under the four-icon threshold).
    expect(screen.getByRole('button', { name: 'Verzetten' })).toBeInTheDocument()
    // Each action carries its OWN icon (its `key`, not a shared generic glyph).
    expect(container.querySelector('.lucide-check')).toBeInTheDocument()
    expect(container.querySelector('.lucide-calendar-clock')).toBeInTheDocument()
  })

  it('falls back to the NL label when an action carries no label_key/tool_label_key', () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Lieke', body: 'x', refs: [],
      action: { tool: 'wijzig_taak', input: {}, label: 'Taak wijzigen' },
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.getByRole('button', { name: 'Taak wijzigen' })).toBeInTheDocument()
  })

  it('falls back to the generic "run" word when an action carries no label at all', () => {
    const suggestion = { kind: 'task_overdue' as const, title: 'Lieke', body: 'x', refs: [], action: { tool: 'wijzig_taak', input: {} } }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.getByRole('button', { name: 'koios.tools.unknown' })).toBeInTheDocument()
  })

  it('names each action from its own label_key over the tool_label_key (real BE action shape, no label)', () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Lieke', body: 'x', refs: [],
      actions: [
        { key: 'complete_task', tool: 'wijzig_taak', input: {}, label_key: 'koios.assistant.actions.complete_task', tool_label_key: 'koios.tools.wijzig_taak' },
        { key: 'reschedule_task', tool: 'wijzig_taak', input: {}, label_key: 'koios.assistant.actions.reschedule_task', tool_label_key: 'koios.tools.wijzig_taak' },
      ],
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    // The key-echo mock proves `label_key` wins over `tool_label_key` for both actions.
    expect(screen.getByRole('button', { name: 'koios.assistant.actions.complete_task' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'koios.assistant.actions.reschedule_task' })).toBeInTheDocument()
  })

  it('falls back to tool_label_key when an action carries no label_key', () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Lieke', body: 'x', refs: [],
      action: { tool: 'wijzig_taak', input: {}, tool_label_key: 'koios.tools.wijzig_taak' },
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.getByRole('button', { name: 'koios.tools.wijzig_taak' })).toBeInTheDocument()
  })

  it('call, mail and WhatsApp icons appear for a row whose ref carries contact data (no send_whatsapp action offered)', () => {
    const suggestion = {
      kind: 'opportunity_closing_soon' as const, title: 'Uitbreiding', body: 'x',
      refs: [{ type: 'candidate', id: 'c7', label: 'Youssef Postma', contact: { mobile: '+31612345678', email: 'y@example.test', whatsapp: true } }],
      action: null,
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.getByRole('link', { name: 'koios.assistant.call' })).toHaveAttribute('href', 'tel:+31612345678')
    expect(screen.getByRole('link', { name: 'koios.assistant.email' })).toHaveAttribute('href', 'mailto:y@example.test')
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.message' }))
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c7', 'communication')
  })

  // CMBE addendum: a contact WITHOUT a live WhatsApp channel (a contact person
  // always has whatsapp:false) and no send_whatsapp action shows no WhatsApp icon at all.
  it('shows NO WhatsApp icon when contact.whatsapp is false and no send_whatsapp action is offered', () => {
    const suggestion = {
      kind: 'candidate_no_contact' as const, title: 'Sanne', body: 'x',
      refs: [{ type: 'candidate', id: 'c1', label: 'Sanne', contact: { phone: '0612345678', whatsapp: false } }],
      action: { tool: 'maak_taak', input: {} },
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.queryByRole('button', { name: 'koios.assistant.message' })).toBeNull()
    // The call icon still renders — only the WhatsApp/message icon is gated.
    expect(screen.getByRole('link', { name: 'koios.assistant.call' })).toBeInTheDocument()
  })

  it('shows the send_whatsapp action icon instead of the standalone WhatsApp icon when both are possible', () => {
    const suggestion = {
      kind: 'candidate_no_contact' as const, title: 'Sanne', body: 'x',
      refs: [{ type: 'candidate', id: 'c1', label: 'Sanne', contact: { whatsapp: true } }],
      actions: [{ key: 'send_whatsapp', tool: 'stuur_whatsapp', input: {}, label_key: 'koios.assistant.actions.send_whatsapp' }],
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.getByRole('button', { name: 'koios.assistant.actions.send_whatsapp' })).toBeInTheDocument()
    // The standalone conversation icon never doubles up with the send_whatsapp action.
    expect(screen.queryByRole('button', { name: 'koios.assistant.message' })).toBeNull()
  })

  it('keeps a single extra action inline even past the four-icon threshold (task overdue always shows its action)', () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Ahmed', body: 'x',
      refs: [{ type: 'candidate', id: 'c1', label: 'Ahmed', contact: { mobile: '+31611111111', email: 'a@example.test', whatsapp: true } }],
      actions: [
        { key: 'complete_task', tool: 'wijzig_taak', input: {}, label_key: 'koios.assistant.actions.complete_task' },
        { key: 'reschedule_task', tool: 'wijzig_taak', input: {}, label_key: 'koios.assistant.actions.reschedule_task' },
      ],
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    // 3 contact icons + primary + chat = 6 icons, past the 4-icon threshold — the
    // one remaining extra action (Reschedule) still renders inline, never in ⋯.
    expect(screen.getByRole('button', { name: 'koios.assistant.actions.complete_task' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'koios.assistant.actions.reschedule_task' })).toBeInTheDocument()
  })

  it('a tool switched off for the organisation or the user gets no button at all; the chat handoff stays', async () => {
    capTools = [capTool('maak_taak', { enabled_for_tenant: false })]
    const suggestion = { kind: 'candidate_no_contact' as const, title: 'Sanne', body: 'x', refs: [{ type: 'candidate', id: 'c1', label: 'Sanne' }], action: { tool: 'maak_taak', input: {} } }
    const onAskKoios = vi.fn()
    render(<KoiosSuggestionRow suggestion={suggestion} onAskKoios={onAskKoios} />)
    expect(await screen.findByRole('button', { name: 'koios.assistant.askKoios' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'koios.tools.maak_taak' })).toBeNull()
    expect(mockPost).not.toHaveBeenCalled()
  })
})

describe('KoiosSuggestionRow · staged/confirm leg (unchanged, moved from KoiosAssistantBlock)', () => {
  it('a parked action confirms via POST /ai/koios/actions/{id}/confirm and shows the executed state', async () => {
    const suggestion = { kind: 'pending_action' as const, title: 'Parked', body: 'Ready', refs: [{ type: 'pending_action', id: 'pa-7', label: 'Parked' }] }
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: /pendingAction\.confirm/ }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/pa-7/confirm'))
    await screen.findByText(/pendingAction\.confirmed/)
  })

  it('Uitvoeren stages the descriptor, shows the preview and confirms with the staged id', async () => {
    const suggestion = { kind: 'task_overdue' as const, title: 'Bel Ahmed', body: 'x', refs: [], action: { tool: 'wijzig_taak', input: { task_id: 't1' } } }
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-77', title: 'Bel Ahmed', preview: [{ label: 'Deadline', before: '26-08-2026', after: '28-08-2026' }] } } })
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.tools.unknown' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/stage', { tool: 'wijzig_taak', input: { task_id: 't1' } }))
    await screen.findByText(/Deadline · 26-08-2026 → 28-08-2026/)
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    fireEvent.click(screen.getByRole('button', { name: /pendingAction\.confirm/ }))
    await waitFor(() => expect(mockPost).toHaveBeenLastCalledWith('/ai/koios/actions/pa-77/confirm'))
    await screen.findByText(/pendingAction\.confirmed/)
  })

  it('stages and shows the preview from an actions[]-only suggestion (no legacy `action`, CMBE addendum)', async () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Bel Ahmed', body: 'x', refs: [],
      actions: [{ key: 'complete_task', tool: 'wijzig_taak', input: { task_id: 't1' }, label_key: 'koios.assistant.actions.complete_task' }],
    }
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-9', title: 'Bel Ahmed', preview: [{ label: 'Status', before: 'open', after: 'done' }] } } })
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.complete_task' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/stage', { tool: 'wijzig_taak', input: { task_id: 't1' } }))
    // The row does not go blank once staging replaces the legacy `action` field.
    await screen.findByText(/Status · open → done/)
  })

  it('a tool needing no confirm executes in one click and opens the vacancy on its candidate-search tab', async () => {
    const suggestion = {
      kind: 'vacancy_zero_applications' as const, title: 'Verzorgende IG', body: 'x', refs: [{ type: 'vacancy', id: 'v1', label: 'Verzorgende IG' }],
      // The button's own name is the tool's word — never a bare "Uitvoeren" (KOIOS-ROW-2).
      action: { key: 'search_candidates', tool: 'zoek_kandidaten', input: { vacature_id: 'v1' }, label: 'Kandidaten zoeken' },
    }
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-1', title: 'Kandidaten zoeken', preview: [] } } })
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: { gelukt: true } } })
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'Kandidaten zoeken' }))
    await screen.findByText(/pendingAction\.confirmed/)
    expect(openEntity).toHaveBeenCalledWith('vacancies', 'v1', 'candidateSearch')
  })
})
