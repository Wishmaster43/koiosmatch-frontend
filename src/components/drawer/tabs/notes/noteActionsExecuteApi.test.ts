/**
 * noteActionsExecuteApi — §13: assert the REQUEST (route/body), never only that
 * a callback fired. The per-item `confirmed` shape is the load-bearing contract
 * here (verified live against the API 2026-08-07 — supersedes the earlier
 * batch-level `confirmed` flag from the original K0 briefing).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { executeNoteActions, fetchWorkflowRun, toExecuteItem } from './noteActionsExecuteApi'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

afterEach(() => vi.clearAllMocks())

describe('toExecuteItem', () => {
  it('narrows an AssistActionItem down to the execute fields, confirmed omitted by default', () => {
    const item = { title: 'Bel terug', type: 'task' as const, due_date: '2026-08-10', note_excerpt: 'call me' }
    expect(toExecuteItem(item)).toEqual({ title: 'Bel terug', type: 'task', due_date: '2026-08-10', note_excerpt: 'call me', confirmed: undefined })
  })

  it('carries confirmed:true when the caller passes it', () => {
    const item = { title: 'Bel terug', type: 'task' as const, due_date: null, note_excerpt: null }
    expect(toExecuteItem(item, true)).toEqual({ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null, confirmed: true })
  })
})

describe('executeNoteActions', () => {
  it('POSTs /ai/koios/notes/actions/execute with items + source, per-item confirmed (never a batch-level flag)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { items: [{ title: 'Bel terug', type: 'task', status: 'pending' }] } })
    const items = [{ title: 'Bel terug', type: 'task' as const, due_date: null, note_excerpt: null }]

    await executeNoteActions(items, { note_id: 'note-1' })

    expect(api.post).toHaveBeenCalledWith(
      '/ai/koios/notes/actions/execute',
      { items: [{ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null }], source: { note_id: 'note-1' } },
      expect.objectContaining({ signal: undefined }),
    )
  })

  it('sends the CONFIRM call with confirmed:true on just the one item', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { items: [{ title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1', template_key: 'koios_create_task' }] } })
    const item = toExecuteItem({ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null }, true)

    await executeNoteActions([item], { note_id: 'note-1' })

    expect(api.post).toHaveBeenCalledWith(
      '/ai/koios/notes/actions/execute',
      { items: [{ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null, confirmed: true }], source: { note_id: 'note-1' } },
      expect.anything(),
    )
  })

  it('omits source entirely for a new, unsaved note', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { items: [] } })
    await executeNoteActions([], {})
    expect(api.post).toHaveBeenCalledWith('/ai/koios/notes/actions/execute', { items: [], source: {} }, expect.anything())
  })

  it('returns the response items array', async () => {
    const responseItems = [{ title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1' }]
    vi.mocked(api.post).mockResolvedValue({ data: { items: responseItems } })
    const result = await executeNoteActions([], {})
    expect(result).toEqual(responseItems)
  })
})

describe('fetchWorkflowRun', () => {
  it('GETs /workflow-runs/{id}', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { id: 'r1', workflow_id: 'w1', status: 'running' } })
    const row = await fetchWorkflowRun('r1')
    expect(api.get).toHaveBeenCalledWith('/workflow-runs/r1', expect.objectContaining({ signal: undefined }))
    expect(row).toEqual({ id: 'r1', workflow_id: 'w1', status: 'running' })
  })
})
