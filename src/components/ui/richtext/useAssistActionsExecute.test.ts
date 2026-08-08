/**
 * useAssistActionsExecute — §13: proves the two explicit user actions
 * (preview, per-item confirm) each send the right REQUEST, that nothing
 * executes on its own (no call happens until `preview`/`confirm` is invoked),
 * and that a confirm re-sends ONLY the one item being confirmed — never the
 * whole batch, so an already-executed sibling can never be silently re-run.
 * Promoted from the note domain (CMFE-KOIOS-CONSISTENCY-1, Danny 09-08) —
 * same assertions, the hook now takes an explicit `source` object instead of
 * a `noteId` string.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAssistActionsExecute } from './useAssistActionsExecute'
import { executeRichTextActions } from './assistActionsExecuteApi'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))
vi.mock('./assistActionsExecuteApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./assistActionsExecuteApi')>()
  return { ...actual, executeRichTextActions: vi.fn() }
})

const suggested = [
  { title: 'Bel terug', type: 'task' as const, due_date: null, note_excerpt: null },
  { title: 'Stuur update', type: 'whatsapp' as const, due_date: null, note_excerpt: null },
]

afterEach(() => vi.clearAllMocks())

describe('useAssistActionsExecute', () => {
  it('starts idle — no request until preview() is explicitly called (no execution without a click)', () => {
    renderHook(() => useAssistActionsExecute({ note_id: 'note-1' }))
    expect(executeRichTextActions).not.toHaveBeenCalled()
  })

  it('preview() sends every item UNCONFIRMED, with source.note_id when editing an existing note', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([
      { title: 'Bel terug', type: 'task', status: 'pending' },
      { title: 'Stuur update', type: 'whatsapp', status: 'pending' },
    ])
    const { result } = renderHook(() => useAssistActionsExecute({ note_id: 'note-1' }))

    await act(async () => { await result.current.preview(suggested) })

    expect(executeRichTextActions).toHaveBeenCalledWith(
      [
        { title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null, message: null, start: null, confirmed: undefined },
        { title: 'Stuur update', type: 'whatsapp', due_date: null, note_excerpt: null, message: null, start: null, confirmed: undefined },
      ],
      { note_id: 'note-1' },
    )
    expect(result.current.status).toBe('success')
    expect(result.current.items?.[0].status).toBe('pending')
  })

  // CMBE 5961c673: the server's per-item reason (e.g. "Wacht op jouw
  // bevestiging.") flows straight through into the item's own `reason`.
  it('preview() spreads the server reason onto a non-executed item', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([
      { title: 'Bel terug', type: 'task', status: 'pending', reason: 'Wacht op jouw bevestiging.' },
    ])
    const { result } = renderHook(() => useAssistActionsExecute({ note_id: 'note-1' }))
    await act(async () => { await result.current.preview([suggested[0]]) })
    expect(result.current.items?.[0].reason).toBe('Wacht op jouw bevestiging.')
  })

  it('preview() omits source entirely when the caller has no linkage (new/unsaved note, or any other field)', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([])
    const { result } = renderHook(() => useAssistActionsExecute())
    await act(async () => { await result.current.preview([]) })
    expect(executeRichTextActions).toHaveBeenCalledWith([], {})
  })

  it('confirm(index) re-sends ONLY that one item, confirmed:true — never the whole batch', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValueOnce([
      { title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1' },
      { title: 'Stuur update', type: 'whatsapp', status: 'pending' },
    ])
    const { result } = renderHook(() => useAssistActionsExecute({ note_id: 'note-1' }))
    await act(async () => { await result.current.preview(suggested) })

    vi.mocked(executeRichTextActions).mockResolvedValueOnce([{ title: 'Stuur update', type: 'whatsapp', status: 'executed', run_id: 'r2' }])
    await act(async () => { await result.current.confirm(1) })

    // Only item index 1 is in the confirm request — index 0 (already executed) never rides along.
    expect(executeRichTextActions).toHaveBeenLastCalledWith(
      [{ title: 'Stuur update', type: 'whatsapp', due_date: null, note_excerpt: null, message: null, start: null, confirmed: true }],
      { note_id: 'note-1' },
    )
    expect(result.current.items?.[1].status).toBe('executed')
    expect(result.current.items?.[1].run_id).toBe('r2')
    // The already-executed sibling is untouched.
    expect(result.current.items?.[0].status).toBe('executed')
    expect(result.current.items?.[0].run_id).toBe('r1')
  })

  it('marks a failed confirm with confirmError, without touching other items', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValueOnce([{ title: 'Bel terug', type: 'task', status: 'pending' }])
    const { result } = renderHook(() => useAssistActionsExecute({ note_id: 'note-1' }))
    await act(async () => { await result.current.preview([suggested[0]]) })

    vi.mocked(executeRichTextActions).mockRejectedValueOnce(new Error('network'))
    await act(async () => { await result.current.confirm(0) })

    expect(result.current.items?.[0].confirmError).toBe(true)
    expect(result.current.items?.[0].confirming).toBe(false)
  })

  it('surfaces an honest error and stays idle-items on a failed preview', async () => {
    vi.mocked(executeRichTextActions).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useAssistActionsExecute({ note_id: 'note-1' }))
    await act(async () => { await result.current.preview(suggested) })
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.items).toBeNull()
    expect(result.current.errorMessage).toBeTruthy()
  })

  it('reset() clears back to idle with no items', async () => {
    vi.mocked(executeRichTextActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'pending' }])
    const { result } = renderHook(() => useAssistActionsExecute({ note_id: 'note-1' }))
    await act(async () => { await result.current.preview([suggested[0]]) })
    expect(result.current.items).not.toBeNull()

    act(() => { result.current.reset() })
    expect(result.current.items).toBeNull()
    expect(result.current.status).toBe('idle')
  })
})
