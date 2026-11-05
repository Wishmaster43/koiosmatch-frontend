/** KoiosSuggestionRow · staged/confirm leg, reschedule, error branch and create_task editors (split from KoiosSuggestionRow.test.tsx; same mocks). */
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

// RESCHEDULE-EDIT-1 / TASK-CREATE-EDIT-1: SuggestionEditor's shared DateField/
// TextField as flat controlled inputs — this suite is about the row's
// stage/editor wiring, not the pickers themselves (covered by fields.test.tsx,
// RescheduleEditor.test.tsx and SuggestionEditor.test.tsx).
vi.mock('@/components/forms/fields', () => ({
  DateField: ({ id, value, onChange }: { id?: string; value?: string; onChange: (v: string) => void }) => (
    <input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  ),
  TextField: ({ id, value, onChange }: { id?: string; value?: string; onChange: (v: string) => void }) => (
    <input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  ),
}))

// TASK-CREATE-EDIT-1: the tenant priority lookup, real shape (value/label/is_default).
const priorities = [
  { value: 'low', label: 'Low', color: 'var(--color-info)', is_default: false },
  { value: 'normal', label: 'Normal', color: 'var(--color-primary)', is_default: true },
  { value: 'high', label: 'High', color: 'var(--text-muted)', is_default: false },
]
vi.mock('@/context/TaskLookupsContext', () => ({
  useTaskLookups: () => ({ priorities, defaultPriority: 'normal' }),
  TaskLookupsProvider: ({ children }: { children: import('react').ReactNode }) => children,
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

describe('KoiosSuggestionRow · staged/confirm leg (unchanged, moved from KoiosAssistantBlock)', () => {
  it('a parked action confirms via POST /ai/koios/actions/{id}/confirm and shows the executed state', async () => {
    const suggestion = { kind: 'pending_action' as const, title: 'Parked', body: 'Ready', refs: [{ type: 'pending_action', id: 'pa-7', label: 'Parked' }] }
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: /pendingAction\.confirm/ }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/ai/koios/actions/pa-7/confirm', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
    await screen.findByText(/pendingAction\.confirmed/)
  })

  it('Run stages the descriptor, shows the preview and confirms with the staged id', async () => {
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
    await waitFor(() => expect(mockPost).toHaveBeenLastCalledWith('/ai/koios/actions/pa-77/confirm', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
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
    await waitFor(() => expect(mockPost).toHaveBeenNthCalledWith(2, '/ai/koios/actions/pa-1/confirm', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
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

describe('KoiosSuggestionRow · create_task editor (TASK-CREATE-EDIT-1)', () => {
  it('clicking create_task opens the editor and does NOT stage', () => {
    const suggestion = {
      kind: 'candidate_no_contact' as const, title: 'Koen Timmermans', body: 'x', refs: [],
      action: { key: 'create_task', tool: 'create_task', input: { candidate_id: 'c-1', title: 'Bel Koen Timmermans' }, label_key: 'koios.assistant.actions.create_task' },
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.create_task' }))
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.getByText('koios.assistant.createTaskTitle')).toBeInTheDocument()
  })

  it('confirming a typed title + picked date + picked priority stages then confirms the exact request', async () => {
    const suggestion = {
      kind: 'candidate_no_contact' as const, title: 'Koen Timmermans', body: 'x', refs: [],
      action: { key: 'create_task', tool: 'create_task', input: { candidate_id: 'c-1', title: 'Bel Koen Timmermans' }, label_key: 'koios.assistant.actions.create_task' },
    }
    mockPost.mockResolvedValueOnce({ data: { status: 'staged', action: { id: 'pa-1', title: 'Bel Koen Timmermans', preview: [] } } })
    mockPost.mockResolvedValueOnce({ data: { status: 'executed', data: {} } })
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.create_task' }))
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: '2026-10-02' } })
    // Priority: the tenant default ("Normal") is preselected — open and pick "High".
    // ROLE-PICKER-LEFT-1: the trigger's accessible name is its label, not the current value.
    fireEvent.click(screen.getByRole('button', { name: 'koios.pendingAction.fields.priority' }))
    fireEvent.click(screen.getByRole('button', { name: /^High$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.createTaskConfirm' }))
    await waitFor(() => expect(mockPost).toHaveBeenNthCalledWith(1, '/ai/koios/actions/stage', {
      tool: 'create_task', input: { candidate_id: 'c-1', title: 'Bel Koen Timmermans', due_date: '2026-10-02', priority: 'high' },
    }))
    await waitFor(() => expect(mockPost).toHaveBeenNthCalledWith(2, '/ai/koios/actions/pa-1/confirm', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
    await screen.findByText(/pendingAction\.confirmed/)
  })

  it('cancel closes the create_task editor without any request', () => {
    const suggestion = {
      kind: 'candidate_no_contact' as const, title: 'Koen Timmermans', body: 'x', refs: [],
      action: { key: 'create_task', tool: 'create_task', input: { candidate_id: 'c-1', title: 'Bel Koen Timmermans' }, label_key: 'koios.assistant.actions.create_task' },
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    fireEvent.click(screen.getByRole('button', { name: 'koios.assistant.actions.create_task' }))
    fireEvent.click(screen.getByRole('button', { name: 'koios.pendingAction.cancel' }))
    expect(mockPost).not.toHaveBeenCalled()
    expect(screen.queryByText('koios.assistant.createTaskTitle')).toBeNull()
  })

  it('REFERENCE-LINK-1: a task_overdue row with a reference ref shows call + mail for the reference, no conversation icon, and a non-interactive chip', () => {
    const suggestion = {
      kind: 'task_overdue' as const, title: 'Bel Karim', body: 'x',
      refs: [{ type: 'reference', id: 'r1', label: 'Referentie A', contact: { mobile: '+31699999999', email: 'ref@example.test', whatsapp: false } }],
    }
    render(<KoiosSuggestionRow suggestion={suggestion} />)
    expect(screen.getByRole('link', { name: 'koios.assistant.callPerson' })).toHaveAttribute('href', 'tel:+31699999999')
    expect(screen.getByRole('link', { name: 'koios.assistant.mailPerson' })).toHaveAttribute('href', 'mailto:ref@example.test')
    // No conversation icon — that stays gated to a `candidate` ref only.
    expect(screen.queryByRole('button', { name: 'koios.assistant.messagePerson' })).toBeNull()
    // The reference chip has no page of its own (koiosResultLinks) — it renders as a
    // non-interactive <div>, not a <button>.
    expect(screen.getByText('Referentie A').closest('div')).toHaveAttribute('title', 'koios.assistant.referenceOf')
    expect(screen.queryByRole('button', { name: 'Referentie A' })).toBeNull()
  })
})
