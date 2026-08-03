/**
 * usePostCreateAttachments — punten 21+22. Proves the post-create sequence
 * runs IN ORDER (every document, then the note), that a failed item never
 * blocks/hides the others (partial-failure discipline, §3 — the vacancy
 * already exists by the time this runs), and that each failed item is
 * independently retryable via the id remembered from the sequence call.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { usePostCreateAttachments } from './usePostCreateAttachments'
import api from '@/lib/api'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }))
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

const file = (name: string) => new File(['x'], name, { type: 'text/plain' })

beforeEach(() => { mockPost.mockReset() })

describe('usePostCreateAttachments · order', () => {
  it('uploads every pending document BEFORE posting the note', async () => {
    const calls: string[] = []
    mockPost.mockImplementation((url: string) => { calls.push(url); return Promise.resolve({ data: {} }) })

    const { result } = renderHook(() => usePostCreateAttachments())
    act(() => { result.current.addFile(file('cv.pdf')); result.current.addFile(file('brief.pdf')) })
    act(() => result.current.setNoteText('Interne notitie'))

    await act(async () => { await result.current.runSequence('v-1') })

    expect(calls).toEqual(['/vacancies/v-1/documents', '/vacancies/v-1/documents', '/vacancies/v-1/notes'])
    expect(result.current.files.every(f => f.status === 'done')).toBe(true)
    expect(result.current.noteStatus).toBe('done')
  })

  it('does nothing when there is nothing pending', () => {
    const { result } = renderHook(() => usePostCreateAttachments())
    expect(result.current.hasPending).toBe(false)
  })
})

describe('usePostCreateAttachments · partial failure', () => {
  it('reports each item independently — a failed document never hides the note or the other documents', async () => {
    mockPost.mockImplementation((url: string, body: unknown) => {
      if (url.endsWith('/documents')) {
        const fd = body as FormData
        if (fd.get('name') === 'bad.pdf') return Promise.reject({ response: { status: 422 } })
        return Promise.resolve({ data: {} })
      }
      return Promise.resolve({ data: {} }) // the note
    })

    const { result } = renderHook(() => usePostCreateAttachments())
    act(() => { result.current.addFile(file('good.pdf')); result.current.addFile(file('bad.pdf')) })
    act(() => result.current.setNoteText('Notitie'))

    await act(async () => { await result.current.runSequence('v-2') })

    const good = result.current.files.find(f => f.name === 'good.pdf')
    const bad = result.current.files.find(f => f.name === 'bad.pdf')
    expect(good?.status).toBe('done')
    expect(bad?.status).toBe('error')
    // The note still ran — one failed document never blocks the rest of the sequence.
    expect(result.current.noteStatus).toBe('done')
  })

  it('retryFile() re-uploads only that one item against the remembered vacancy id', async () => {
    let documentCalls = 0
    mockPost.mockImplementation((url: string) => {
      if (url.endsWith('/documents')) {
        documentCalls += 1
        return documentCalls === 1 ? Promise.reject({ response: { status: 500 } }) : Promise.resolve({ data: {} })
      }
      return Promise.resolve({ data: {} })
    })

    const { result } = renderHook(() => usePostCreateAttachments())
    act(() => result.current.addFile(file('cv.pdf')))
    await act(async () => { await result.current.runSequence('v-3') })
    expect(result.current.files[0].status).toBe('error')

    await act(async () => { await result.current.retryFile(result.current.files[0].id) })
    await waitFor(() => expect(result.current.files[0].status).toBe('done'))
    expect(mockPost).toHaveBeenCalledWith('/vacancies/v-3/documents', expect.any(FormData), expect.objectContaining({ headers: expect.any(Object) }))
  })

  it('retryNote() re-posts only the note against the remembered vacancy id', async () => {
    let noteCalls = 0
    mockPost.mockImplementation((url: string) => {
      if (url.endsWith('/notes')) {
        noteCalls += 1
        return noteCalls === 1 ? Promise.reject({ response: { status: 500 } }) : Promise.resolve({ data: {} })
      }
      return Promise.resolve({ data: {} })
    })

    const { result } = renderHook(() => usePostCreateAttachments())
    act(() => result.current.setNoteText('Notitie'))
    await act(async () => { await result.current.runSequence('v-4') })
    expect(result.current.noteStatus).toBe('error')

    await act(async () => { await result.current.retryNote() })
    expect(result.current.noteStatus).toBe('done')
    expect(mockPost).toHaveBeenCalledWith('/vacancies/v-4/notes', { body: 'Notitie' })
  })
})
