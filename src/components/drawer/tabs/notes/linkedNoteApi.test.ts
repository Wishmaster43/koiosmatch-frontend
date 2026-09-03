/**
 * linkedNoteApi — request pins (K-288): the exact method/route/body per source
 * family (measured against the backend routes, not the earlier PATCH-except-
 * opportunity assumption), and the pop-out URL/window helper.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/api'
import { patchLinkedNote, linkedNotePopoutUrl, openLinkedNotePopout } from './linkedNoteApi'
import type { NoteFeedItem } from '@/hooks/useNoteFeed'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { patch: vi.fn(), put: vi.fn() } }
})

// vi.mock factories are hoisted above const declarations, so the spy referenced
// inside must be created via vi.hoisted (mirrors NotesTab.test.tsx's own idiom).
const { openNoteEditPopoutMock } = vi.hoisted(() => ({ openNoteEditPopoutMock: vi.fn() }))
vi.mock('@/lib/secondScreen', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/secondScreen')>()),
  openNoteEditPopout: openNoteEditPopoutMock,
}))

// Base feed item — override per test (source/type/title).
const item = (over: Partial<NoteFeedItem> = {}): NoteFeedItem => ({
  id: 'n1', note_type: 'candidate_note',
  source: { type: 'candidate', id: 'c1', label: 'Ahmed Bakker', deleted: false },
  body: 'old body', type: 'general', author: 'Kelly', language: null,
  created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
  is_direct: false, principals: [], can_manage: true,
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('patchLinkedNote', () => {
  it('PATCHes the candidate route with body + type', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} } as never)
    const ok = await patchLinkedNote(item(), 'new body')
    expect(ok).toBe(true)
    expect(api.patch).toHaveBeenCalledWith('/candidates/c1/notes/n1', { body: 'new body', type: 'general' })
  })

  it('PUTs the match route (not PATCH)', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} } as never)
    const ok = await patchLinkedNote(item({ id: 'n2', source: { type: 'match', id: 'm1', label: 'Match', deleted: false } }), 'edited')
    expect(ok).toBe(true)
    expect(api.put).toHaveBeenCalledWith('/matches/m1/notes/n2', { body: 'edited', type: 'general' })
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('PUTs the exact task route', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} } as never)
    await patchLinkedNote(item({ id: 'n3', source: { type: 'task', id: 't7', label: 'Taak', deleted: false } }), 'edited')
    expect(api.put).toHaveBeenCalledWith('/tasks/t7/notes/n3', { body: 'edited', type: 'general' })
  })

  it('omits type when the item has none', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} } as never)
    await patchLinkedNote(item({ type: null }), 'new body')
    expect(api.patch).toHaveBeenCalledWith('/candidates/c1/notes/n1', { body: 'new body' })
  })

  it('adds title only for an application source that already carries one', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} } as never)
    await patchLinkedNote(item({ source: { type: 'application', id: 'a1', label: 'Sollicitatie', deleted: false }, title: 'Intake' }), 'new body')
    expect(api.patch).toHaveBeenCalledWith('/applications/a1/notes/n1', { body: 'new body', type: 'general', title: 'Intake' })
  })

  it('never sends title for a non-application source, even when the item has one', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} } as never)
    await patchLinkedNote(item({ source: { type: 'match', id: 'm1', label: 'Match', deleted: false }, title: 'Should not ship' }), 'new body')
    expect(api.put).toHaveBeenCalledWith('/matches/m1/notes/n1', { body: 'new body', type: 'general' })
  })

  it('resolves false on a server error, never throws', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new Error('boom'))
    const ok = await patchLinkedNote(item(), 'new body')
    expect(ok).toBe(false)
  })

  it('resolves false for an unmapped source family or a missing source id', async () => {
    expect(await patchLinkedNote(item({ source: { type: 'unknown', id: 'x', label: null, deleted: false } }), 'x')).toBe(false)
    expect(await patchLinkedNote(item({ source: { type: 'candidate', id: null, label: null, deleted: true } }), 'x')).toBe(false)
    expect(api.patch).not.toHaveBeenCalled()
  })
})

describe('linkedNotePopoutUrl / openLinkedNotePopout', () => {
  it('builds the note-id-in-URL popout route for a mapped, alive source', () => {
    expect(linkedNotePopoutUrl(item())).toBe('/popout/notes/candidate/c1/n1')
  })

  it('is null for a deleted source (no id to route to)', () => {
    expect(linkedNotePopoutUrl(item({ source: { type: 'candidate', id: null, label: null, deleted: true } }))).toBeNull()
  })

  it('opens via the shared openNoteEditPopout helper — same window name/helper, never a forked one', () => {
    openLinkedNotePopout(item())
    expect(openNoteEditPopoutMock).toHaveBeenCalledWith('candidate', 'c1', 'n1')
  })

  it('does not call the window helper when there is nothing to route to', () => {
    openLinkedNotePopout(item({ source: { type: 'candidate', id: null, label: null, deleted: true } }))
    expect(openNoteEditPopoutMock).not.toHaveBeenCalled()
  })
})
