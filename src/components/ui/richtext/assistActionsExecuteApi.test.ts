/**
 * assistActionsExecuteApi — §13: assert the REQUEST (route/body), never only
 * that a callback fired. The per-item `confirmed` shape is the load-bearing
 * contract here (verified live against the API 2026-08-07 — supersedes the
 * earlier batch-level `confirmed` flag from the original K0 briefing).
 * Promoted from the note domain (CMFE-KOIOS-CONSISTENCY-1, Danny 09-08) —
 * same assertions, `source` now built explicitly per test instead of derived
 * from a `noteId` string.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { executeRichTextActions, fetchWorkflowRun, toExecuteItem } from './assistActionsExecuteApi'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

afterEach(() => vi.clearAllMocks())

describe('toExecuteItem', () => {
  it('narrows a RichTextAssistActionItem down to the execute fields, confirmed omitted by default', () => {
    const item = { title: 'Bel terug', type: 'task' as const, due_date: '2026-08-10', note_excerpt: 'call me' }
    expect(toExecuteItem(item)).toEqual({
      title: 'Bel terug', type: 'task', due_date: '2026-08-10', note_excerpt: 'call me',
      message: null, start: null, confirmed: undefined,
    })
  })

  it('carries confirmed:true when the caller passes it', () => {
    const item = { title: 'Bel terug', type: 'task' as const, due_date: null, note_excerpt: null }
    expect(toExecuteItem(item, true)).toEqual({
      title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null,
      message: null, start: null, confirmed: true,
    })
  })

  // CMBE 5961c673: the assist response's draft message/start ride straight
  // into the execute body — never dropped on the way to confirm.
  it('forwards message (whatsapp/email draft) and start (appointment) when present', () => {
    const messageItem = { title: 'Stuur update', type: 'whatsapp' as const, due_date: null, note_excerpt: null, message: 'Hoi, even een update.', start: null }
    expect(toExecuteItem(messageItem)).toEqual({
      title: 'Stuur update', type: 'whatsapp', due_date: null, note_excerpt: null,
      message: 'Hoi, even een update.', start: null, confirmed: undefined,
    })

    const appointmentItem = { title: 'Intake plannen', type: 'appointment' as const, due_date: null, note_excerpt: null, message: null, start: '2026-08-10 10:00' }
    expect(toExecuteItem(appointmentItem, true)).toEqual({
      title: 'Intake plannen', type: 'appointment', due_date: null, note_excerpt: null,
      message: null, start: '2026-08-10 10:00', confirmed: true,
    })
  })
})

describe('executeRichTextActions', () => {
  it('POSTs /ai/koios/notes/actions/execute with items + source, per-item confirmed (never a batch-level flag)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { items: [{ title: 'Bel terug', type: 'task', status: 'pending' }] } })
    const items = [{ title: 'Bel terug', type: 'task' as const, due_date: null, note_excerpt: null, message: null, start: null }]

    await executeRichTextActions(items, { note_id: 'note-1' })

    expect(api.post).toHaveBeenCalledWith(
      '/ai/koios/notes/actions/execute',
      { items: [{ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null, message: null, start: null }], source: { note_id: 'note-1' } },
      expect.objectContaining({ signal: undefined }),
    )
  })

  // CMBE 5961c673: message/start ride in the execute POST body untouched.
  it('POSTs message (whatsapp/email draft) and start (appointment) through to the request body', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { items: [{ title: 'Stuur update', type: 'whatsapp', status: 'executed' }] } })
    const items = [{ title: 'Stuur update', type: 'whatsapp' as const, due_date: null, note_excerpt: null, message: 'Hoi, even een update.', start: null }]

    await executeRichTextActions(items, { note_id: 'note-1' })

    expect(api.post).toHaveBeenCalledWith(
      '/ai/koios/notes/actions/execute',
      { items: [{ title: 'Stuur update', type: 'whatsapp', due_date: null, note_excerpt: null, message: 'Hoi, even een update.', start: null }], source: { note_id: 'note-1' } },
      expect.anything(),
    )
  })

  it('sends the CONFIRM call with confirmed:true on just the one item', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { items: [{ title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1', template_key: 'koios_create_task' }] } })
    const item = toExecuteItem({ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null }, true)

    await executeRichTextActions([item], { note_id: 'note-1' })

    expect(api.post).toHaveBeenCalledWith(
      '/ai/koios/notes/actions/execute',
      { items: [{ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null, message: null, start: null, confirmed: true }], source: { note_id: 'note-1' } },
      expect.anything(),
    )
  })

  it('omits source entirely for a field with no linkage (new/unsaved note, or any other rich-text field)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { items: [] } })
    await executeRichTextActions([], {})
    expect(api.post).toHaveBeenCalledWith('/ai/koios/notes/actions/execute', { items: [], source: {} }, expect.anything())
  })

  it('returns the response items array', async () => {
    const responseItems = [{ title: 'Bel terug', type: 'task', status: 'executed', run_id: 'r1' }]
    vi.mocked(api.post).mockResolvedValue({ data: { items: responseItems } })
    const result = await executeRichTextActions([], {})
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

// K-159: the edit-before-execute task fields ride the request verbatim — and
// stay OMITTED when unset (the server's requester-fallback must keep working).
describe('toExecuteItem · K-159 task fields', () => {
  it('carries assignee_user_id and link_type/link_id when set', () => {
    const body = toExecuteItem({
      title: 'BHV beoordelen', type: 'task', due_date: '2026-09-01', note_excerpt: null,
      assignee_user_id: 'u1', link_type: 'vacancy', link_id: 'v9',
    } as never, true)
    expect(body).toMatchObject({ assignee_user_id: 'u1', link_type: 'vacancy', link_id: 'v9', confirmed: true })
  })

  it('omits them entirely when unset', () => {
    const body = toExecuteItem({ title: 'Bel terug', type: 'task', due_date: null, note_excerpt: null } as never)
    expect('assignee_user_id' in body).toBe(false)
    expect('link_type' in body).toBe(false)
  })
})

