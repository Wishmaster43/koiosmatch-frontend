/**
 * useNoteActionsExecute — §13: proves the two explicit user actions (preview,
 * per-item confirm) each send the right REQUEST, that nothing executes on its
 * own (no call happens until `preview`/`confirm` is invoked), and that a
 * confirm re-sends ONLY the one item being confirmed — never the whole batch,
 * so an already-executed sibling can never be silently re-run.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useNoteActionsExecute } from './useNoteActionsExecute'
import { executeNoteActions } from './noteActionsExecuteApi'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k }) }))
vi.mock('./noteActionsExecuteApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./noteActionsExecuteApi')>()
  return { ...actual, executeNoteActions: vi.fn() }
})

const suggested = [
  { title: 'Bel terug', type: 'task' as const, due_date: null, note_excerpt: null },
  { title: 'Stuur update', type: 'whatsapp' as const, due_date: null, note_excerpt: null },
]

afterEach(() => vi.clearAllMocks())

describe('useNoteActionsExecute', () => {
  it('starts idle — no request until preview() is explicitly called (no execution without a click)', () => {
    renderHook(() => useNoteActionsExecute('note-1'))
    expect(executeNoteActions).not.toHaveBeenCalled()
  })

  it('preview() sends every item UNCONFIRMED, with source.note_id when editing an existing note', async () => {
    vi.mocked(executeNoteActions).mockResolvedValue([
      { title: 'Bel terug', type: 'task', status: 'pending' },
      { title: 'Stuur update', type: 'whatsapp', status: 'pending' },
    ])
    const { result } = renderHook(() => useNoteActionsExecute('note-1'))

    await act(async () => { await result.current.preview(suggested) })

    expect(executeNoteActions).toHaveBeenCalledWith(
      [
        { title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null, confirmed: undefined },
        { title: 'Stuur update', type: 'whatsapp', due_date: null, note_excerpt: null, confirmed: undefined },
      ],
      { note_id: 'note-1' },
    )
    expect(result.current.status).toBe('success')
    expect(result.current.items?.[0].status).toBe('pending')
  })

  it('preview() omits source entirely for a new, unsaved note (no noteId)', async () => {
    vi.mocked(executeNoteActions).mockResolvedValue([])
    const { result } = renderHook(() => useNoteActionsExecute(undefined))
    await act(async () => { await result.current.preview([]) })
    expect(executeNoteActions).toHaveBeenCalledWith([], {})
  })

  it('confirm(index) re-sends ONLY that one item, confirmed:true — never the whole batch', async () => {
    vi.mocked(executeNoteActions).mockResolvedValueOnce([
      { title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1' },
      { title: 'Stuur update', type: 'whatsapp', status: 'pending' },
    ])
    const { result } = renderHook(() => useNoteActionsExecute('note-1'))
    await act(async () => { await result.current.preview(suggested) })

    vi.mocked(executeNoteActions).mockResolvedValueOnce([{ title: 'Stuur update', type: 'whatsapp', status: 'executed', run_id: 'r2' }])
    await act(async () => { await result.current.confirm(1) })

    // Only item index 1 is in the confirm request — index 0 (already executed) never rides along.
    expect(executeNoteActions).toHaveBeenLastCalledWith(
      [{ title: 'Stuur update', type: 'whatsapp', due_date: null, note_excerpt: null, confirmed: true }],
      { note_id: 'note-1' },
    )
    expect(result.current.items?.[1].status).toBe('executed')
    expect(result.current.items?.[1].run_id).toBe('r2')
    // The already-executed sibling is untouched.
    expect(result.current.items?.[0].status).toBe('executed')
    expect(result.current.items?.[0].run_id).toBe('r1')
  })

  it('marks a failed confirm with confirmError, without touching other items', async () => {
    vi.mocked(executeNoteActions).mockResolvedValueOnce([{ title: 'Bel terug', type: 'task', status: 'pending' }])
    const { result } = renderHook(() => useNoteActionsExecute('note-1'))
    await act(async () => { await result.current.preview([suggested[0]]) })

    vi.mocked(executeNoteActions).mockRejectedValueOnce(new Error('network'))
    await act(async () => { await result.current.confirm(0) })

    expect(result.current.items?.[0].confirmError).toBe(true)
    expect(result.current.items?.[0].confirming).toBe(false)
  })

  it('surfaces an honest error and stays idle-items on a failed preview', async () => {
    vi.mocked(executeNoteActions).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useNoteActionsExecute('note-1'))
    await act(async () => { await result.current.preview(suggested) })
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.items).toBeNull()
    expect(result.current.errorMessage).toBeTruthy()
  })

  it('reset() clears back to idle with no items', async () => {
    vi.mocked(executeNoteActions).mockResolvedValue([{ title: 'Bel terug', type: 'task', status: 'pending' }])
    const { result } = renderHook(() => useNoteActionsExecute('note-1'))
    await act(async () => { await result.current.preview([suggested[0]]) })
    expect(result.current.items).not.toBeNull()

    act(() => { result.current.reset() })
    expect(result.current.items).toBeNull()
    expect(result.current.status).toBe('idle')
  })
})
