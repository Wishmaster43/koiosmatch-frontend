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

// RESCHEDULE-EDIT-1: RescheduleEditor's shared DateField as a flat controlled
// input — this suite is about the row's stage/editor wiring, not the picker
// itself (covered by fields.test.tsx and RescheduleEditor.test.tsx).
vi.mock('@/components/forms/fields', () => ({
  DateField: ({ id, value, onChange }: { id?: string; value?: string; onChange: (v: string) => void }) => (
    <input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  ),
}))

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

// KOIOS-SUGGEST-COMPACT-2 (Danny 28-09: "Ik heb nu 2 icons links staan"): a row with a
// primary ref renders exactly ONE leading icon — its own kind/task-type glyph drawn INTO
// the record chip, never the chip's default entity glyph stacked next to it.
describe('KoiosSuggestionRow · one icon per row (KOIOS-SUGGEST-COMPACT-2)', () => {
  it('renders exactly one leading icon (the task type glyph), never the chip default too', () => {
    // A vacancy ref with no actions/contact so the row carries no OTHER icon (no
    // conversation/channel/action/chat glyph) — the count below is unambiguous.
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Bel Ahmed', body: 'x', refs: [{ type: 'vacancy', id: 'v1', label: 'Verzorgende IG' }],
      params: { days_overdue: 2, task_type: { icon: 'phone', color: 'var(--color-info)', label: 'Belafspraak' } },
    }
    const { container } = render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(container.querySelectorAll('svg').length).toBe(1)
    // The one icon carries the task type's OWN colour (never a colourless fallback).
    expect(container.querySelector('svg')).toHaveAttribute('stroke', 'var(--color-info)')
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

  // KOIOS-EN-1 phase B: when tool_label_key itself does not resolve (a stale
  // Dutch-id key the locale no longer carries), toolLabel falls through to
  // `koios.tools.<canonicalToolId(tool)>` — proven with a `t` mock that mimics
  // real i18next's unresolved-key + defaultValue behaviour, unlike this file's
  // key-echo stub used everywhere else (see file header).
  it('falls back to koios.tools.<canonicalToolId> when tool_label_key itself does not resolve', async () => {
    vi.resetModules()
    vi.doMock('react-i18next', async (importOriginal) => ({
      ...(await importOriginal<typeof import('react-i18next')>()),
      useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
          if (key === 'koios.tools.missing_x') return (opts?.defaultValue as string) ?? key
          return key
        },
      }),
    }))
    const { default: FreshRow } = await import('./KoiosSuggestionRow')
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Lieke', body: 'x', refs: [],
      action: { tool: 'wijzig_taak', input: {}, tool_label_key: 'koios.tools.missing_x' },
    }
    render(<FreshRow suggestion={suggestion} />)
    expect(screen.getByRole('button', { name: 'koios.tools.update_task' })).toBeInTheDocument()
    vi.doUnmock('react-i18next')
    vi.resetModules()
  })

  it('call and mail icons appear for a row whose ref carries contact data, named after the person (KOIOS-SUGGEST-COMPACT-2)', () => {
    const suggestion = {
      kind: 'opportunity_closing_soon' as const, title: 'Uitbreiding', body: 'x',
      refs: [{ type: 'contact', id: 'c7', label: 'Youssef Postma', contact: { mobile: '+31612345678', email: 'y@example.test', whatsapp: true } }],
      action: null,
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.getByRole('link', { name: 'koios.assistant.callPerson' })).toHaveAttribute('href', 'tel:+31612345678')
    expect(screen.getByRole('link', { name: 'koios.assistant.mailPerson' })).toHaveAttribute('href', 'mailto:y@example.test')
  })

  // KOIOS-SUGGEST-COMPACT-2 (Danny 28-09: "Bij kandidaat mis ik conversatie starten"):
  // a candidate ref ALWAYS gets the conversation icon now — the old contact.whatsapp
  // gate is gone — even when contact.whatsapp is false or absent.
  it('shows the conversation icon for a candidate ref regardless of contact.whatsapp, opening the Communicatie tab', () => {
    const suggestion = {
      kind: 'candidate_no_contact' as const, title: 'Sanne', body: 'x',
      refs: [{ type: 'candidate', id: 'c1', label: 'Sanne', contact: { phone: '0612345678', whatsapp: false } }],
      action: { tool: 'maak_taak', input: {} },
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.messagePerson' }))
    expect(openEntity).toHaveBeenCalledWith('candidates', 'c1', 'communication:conversations:start')
    // The call icon still renders too.
    expect(screen.getByRole('link', { name: 'koios.assistant.callPerson' })).toBeInTheDocument()
  })

  it('shows the send_whatsapp action icon instead of the standalone conversation icon when both are possible', () => {
    const suggestion = {
      kind: 'candidate_no_contact' as const, title: 'Sanne', body: 'x',
      refs: [{ type: 'candidate', id: 'c1', label: 'Sanne', contact: { whatsapp: true } }],
      actions: [{ key: 'send_whatsapp', tool: 'stuur_whatsapp', input: {}, label_key: 'koios.assistant.actions.send_whatsapp' }],
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.getByRole('button', { name: 'koios.assistant.actions.send_whatsapp' })).toBeInTheDocument()
    // The standalone conversation icon never doubles up with the send_whatsapp action.
    expect(screen.queryByRole('button', { name: 'koios.assistant.messagePerson' })).toBeNull()
  })

  it('keeps a single extra action inline even past the six-icon threshold (task overdue always shows its action)', () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Ahmed', body: 'x',
      refs: [{ type: 'candidate', id: 'c1', label: 'Ahmed', contact: { mobile: '+31611111111', email: 'a@example.test', whatsapp: true } }],
      actions: [
        { key: 'complete_task', tool: 'wijzig_taak', input: {}, label_key: 'koios.assistant.actions.complete_task' },
        { key: 'reschedule_task', tool: 'wijzig_taak', input: {}, label_key: 'koios.assistant.actions.reschedule_task' },
      ],
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    // Call + mail + conversation + primary + chat = 5 icons already, plus the one
    // remaining extra action (Reschedule) — it still renders inline, never in ⋯.
    expect(screen.getByRole('button', { name: 'koios.assistant.actions.complete_task' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'koios.assistant.actions.reschedule_task' })).toBeInTheDocument()
  })

  it('two person refs (candidate + contact) each get their own named call/mail icons', () => {
    const suggestion = {
      kind: 'opportunity_closing_soon' as const, title: 'Uitbreiding', body: 'x',
      refs: [
        { type: 'candidate', id: 'c1', label: 'Ahmed', contact: { mobile: '+31611111111', email: 'ahmed@example.test' } },
        { type: 'contact', id: 'k1', label: 'Klant Contact', contact: { phone: '0201234567', email: 'klant@example.test' } },
      ],
      action: null,
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    // Both people's channel buttons render (4 channel icons total), each carrying its own href.
    expect(screen.getAllByRole('link', { name: 'koios.assistant.callPerson' })[0]).toHaveAttribute('href', 'tel:+31611111111')
    expect(screen.getAllByRole('link', { name: 'koios.assistant.mailPerson' })[0]).toHaveAttribute('href', 'mailto:ahmed@example.test')
    expect(screen.getAllByRole('link', { name: 'koios.assistant.callPerson' })[1]).toHaveAttribute('href', 'tel:0201234567')
    expect(screen.getAllByRole('link', { name: 'koios.assistant.mailPerson' })[1]).toHaveAttribute('href', 'mailto:klant@example.test')
  })

  it('the extra action stays inline while a second person\'s channels fold into the overflow menu', () => {
    const suggestion = {
      kind: 'opportunity_closing_soon' as const, title: 'Uitbreiding', body: 'x',
      refs: [
        { type: 'candidate', id: 'c1', label: 'Ahmed', contact: { mobile: '+31611111111', email: 'ahmed@example.test' } },
        { type: 'contact', id: 'k1', label: 'Klant Contact', contact: { phone: '0201234567', email: 'klant@example.test' } },
      ],
      actions: [
        { key: 'search_candidates', tool: 'zoek_kandidaten', input: {}, label_key: 'koios.assistant.actions.search_candidates' },
        { key: 'reschedule_task', tool: 'wijzig_taak', input: {}, label_key: 'koios.assistant.actions.reschedule_task' },
      ],
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    // Ahmed's own channels and the extra action stay inline.
    expect(screen.getAllByRole('link', { name: 'koios.assistant.callPerson' })[0]).toHaveAttribute('href', 'tel:+31611111111')
    expect(screen.getAllByRole('link', { name: 'koios.assistant.mailPerson' })[0]).toHaveAttribute('href', 'mailto:ahmed@example.test')
    expect(screen.getByRole('button', { name: 'koios.assistant.actions.reschedule_task' })).toBeInTheDocument()
    // The second person's channels are not rendered inline; only Ahmed's link shows.
    expect(screen.getAllByRole('link', { name: 'koios.assistant.callPerson' })).toHaveLength(1)
    const moreButton = screen.getByRole('button', { name: 'koios.assistant.moreActions' })
    expect(moreButton).toBeInTheDocument()
    fireEvent.click(moreButton)
    expect(screen.getByText('koios.assistant.callPerson')).toBeInTheDocument()
    expect(screen.getByText('koios.assistant.mailPerson')).toBeInTheDocument()
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
    // Shaped through pendingPreview (RESCHEDULE-EDIT-1): a translated field key,
    // never the server's raw "Deadline" label or an untranslated ISO date.
    await screen.findByText(/koios\.pendingAction\.fields\.due_date · 26-08-2026 → 28-08-2026/)
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
    await screen.findByText(/koios\.pendingAction\.fields\.status · open → done/)
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

describe('KoiosSuggestionRow · reschedule editor (RESCHEDULE-EDIT-1)', () => {
  it('clicking a reschedule action (input carries `due_date`) opens the editor and does NOT stage yet', () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Offerte opstellen', body: 'x', refs: [],
      action: { key: 'reschedule_task', tool: 'update_task', input: { task_id: 't-1', due_date: '2026-09-29' }, label_key: 'koios.assistant.actions.reschedule_task' },
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.reschedule_task' }))
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.getAllByText('koios.assistant.rescheduleTitle').length).toBeGreaterThan(0)
  })

  it('confirming the edited date stages then confirms in one step with the edited ISO day, then shows the executed notice', async () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Offerte opstellen', body: 'x', refs: [],
      action: { key: 'reschedule_task', tool: 'update_task', input: { task_id: 't-1', due_date: '2026-09-29' }, label_key: 'koios.assistant.actions.reschedule_task' },
    }
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-1', title: 'Offerte opstellen', preview: [] } } })
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.reschedule_task' }))
    fireEvent.change(screen.getByDisplayValue('2026-09-29'), { target: { value: '2026-10-02' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.rescheduleConfirm' }))
    // ONE user click drives BOTH server round trips: stage with the edited input, then confirm.
    await waitFor(() => expect(mockPost).toHaveBeenNthCalledWith(1, '/ai/koios/actions/stage', { tool: 'update_task', input: { task_id: 't-1', due_date: '2026-10-02' } }))
    await waitFor(() => expect(mockPost).toHaveBeenNthCalledWith(2, '/ai/koios/actions/pa-1/confirm'))
    await screen.findByText(/pendingAction\.confirmed/)
  })

  it('cancel closes the editor without any request', () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Offerte opstellen', body: 'x', refs: [],
      action: { key: 'reschedule_task', tool: 'update_task', input: { task_id: 't-1', due_date: '2026-09-29' }, label_key: 'koios.assistant.actions.reschedule_task' },
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.reschedule_task' }))
    fireEvent.click(screen.getByRole('button', { name: 'koios.pendingAction.cancel' }))
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.queryAllByText('koios.assistant.rescheduleTitle').length).toBe(0)
  })

  it('a complete_task click (no `due_date` in its input) still stages directly, no editor, and shapes the preview through pendingPreview', async () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Offerte opstellen', body: 'x', refs: [],
      action: { key: 'complete_task', tool: 'update_task', input: { task_id: 't-1' }, label_key: 'koios.assistant.actions.complete_task' },
    }
    mockPost.mockResolvedValueOnce({
      data: {
        status: 'staged', action: {
          id: 'pa-2', title: 'Offerte opstellen',
          preview: [{ label: 'task_id', text: 't-1' }, { label: 'title', text: 'Offerte opstellen' }, { label: 'due_date', text: '2026-09-29' }],
        },
      },
    })
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.complete_task' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/stage', { tool: 'update_task', input: { task_id: 't-1' } }))
    expect(screen.queryAllByText('koios.assistant.rescheduleTitle').length).toBe(0)
    // A translated field label + the date shaped DD-MM-YYYY (DATUM-1) reaches the screen…
    expect(screen.getByText(/koios\.pendingAction\.fields\.title: Offerte opstellen/)).toBeInTheDocument()
    expect(screen.getByText(/29-09-2026/)).toBeInTheDocument()
    // …never the raw parameter key, its ISO date, or the id row's own value.
    expect(screen.queryByText(/2026-09-29/)).toBeNull()
    expect(screen.queryByText(/t-1/)).toBeNull()
  })
})

describe('KoiosSuggestionRow · useStageAndConfirm error branch (SHARED-UNIT-TEST-1)', () => {
  it('shows the error notice and never confirms when the stage POST itself rejects', async () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Offerte opstellen', body: 'x', refs: [],
      action: { key: 'reschedule_task', tool: 'update_task', input: { task_id: 't-1', due_date: '2026-09-29' }, label_key: 'koios.assistant.actions.reschedule_task' },
    }
    mockPost.mockRejectedValueOnce(new Error('network down'))
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.reschedule_task' }))
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.rescheduleConfirm' }))
    await screen.findByRole('alert')
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/stage', { tool: 'update_task', input: { task_id: 't-1', due_date: '2026-09-29' } })
  })

  it('shows the error notice and never confirms when the stage call resolves without `staged`', async () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Offerte opstellen', body: 'x', refs: [],
      action: { key: 'reschedule_task', tool: 'update_task', input: { task_id: 't-1', due_date: '2026-09-29' }, label_key: 'koios.assistant.actions.reschedule_task' },
    }
    mockPost.mockResolvedValueOnce({ data: { status: 'error', message: 'budget exceeded' } })
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.reschedule_task' }))
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.rescheduleConfirm' }))
    await screen.findByText('budget exceeded')
    expect(mockPost).toHaveBeenCalledTimes(1)
  })
})
