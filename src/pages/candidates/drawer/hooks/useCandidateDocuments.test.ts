/**
 * useCandidateDocuments — N008-DOC-EXPIRY-FE-1 request-seam coverage: the
 * upload POST carries `expires_at` only when the recruiter picked one, and a
 * refused (422) upload drops the optimistic row and surfaces the server's own
 * reason (§13 — mutation tests assert the request, never only that a callback
 * fired).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCandidateDocuments } from './useCandidateDocuments'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Candidate } from '@/types/candidate'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...actual.default, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

const mockedPost = vi.mocked(api.post)
const mockedNotifyError = vi.mocked(notifyError)

afterEach(() => vi.clearAllMocks())

const candidate = { id: 'c1', documents: [] } as unknown as Candidate

describe('useCandidateDocuments · uploadAll (N008-DOC-EXPIRY-FE-1)', () => {
  it('POSTs without the expires_at key when no date was picked', async () => {
    mockedPost.mockResolvedValue({ data: { data: { id: 'd1', name: 'cv.pdf', size: 1024 } } })
    const { result } = renderHook(() => useCandidateDocuments(candidate))
    act(() => {
      result.current.setPending([{ file: new File(['x'], 'cv.pdf'), objectUrl: 'blob:a', name: 'cv.pdf', size: '1 KB', type: 'CV', linkTo: '' }])
    })
    act(() => result.current.uploadAll())
    await waitFor(() => expect(mockedPost).toHaveBeenCalled())
    const [url, body] = mockedPost.mock.calls[0]
    expect(url).toBe('/candidates/c1/documents')
    expect((body as FormData).get('expires_at')).toBeNull()
  })

  it('POSTs with the expires_at key when a date was picked', async () => {
    mockedPost.mockResolvedValue({ data: { data: { id: 'd2', name: 'vog.pdf', size: 1024 } } })
    const { result } = renderHook(() => useCandidateDocuments(candidate))
    act(() => {
      result.current.setPending([{ file: new File(['x'], 'vog.pdf'), objectUrl: 'blob:b', name: 'vog.pdf', size: '1 KB', type: 'VOG', linkTo: '', expiresAt: '2027-03-31' }])
    })
    act(() => result.current.uploadAll())
    await waitFor(() => expect(mockedPost).toHaveBeenCalled())
    const body = mockedPost.mock.calls[0][1] as FormData
    expect(body.get('expires_at')).toBe('2027-03-31')
  })

  it('drops the optimistic row and notifies the server reason on a 422 (expires_at required)', async () => {
    mockedPost.mockRejectedValue({ response: { data: { errors: { expires_at: ['Dit documenttype vereist een vervaldatum.'] } } } })
    const { result } = renderHook(() => useCandidateDocuments(candidate))
    act(() => {
      result.current.setPending([{ file: new File(['x'], 'vog.pdf'), objectUrl: 'blob:c', name: 'vog.pdf', size: '1 KB', type: 'VOG', linkTo: '' }])
    })
    act(() => result.current.uploadAll())
    // The optimistic row is appended synchronously, then removed once the 422 lands.
    await waitFor(() => expect(result.current.docs.some(d => d.name === 'vog.pdf')).toBe(false))
    expect(mockedNotifyError).toHaveBeenCalledWith('Dit documenttype vereist een vervaldatum.')
  })
})

describe('useCandidateDocuments · lane 08 regressions', () => {
  it('does not upload a stale expires_at after the type switched', async () => {
    mockedPost.mockResolvedValue({ data: { data: { id: 'd3', name: 'x.pdf', size: 1 } } })
    const { result } = renderHook(() => useCandidateDocuments(candidate))
    act(() => {
      result.current.setPending([{ file: new File(['x'], 'x.pdf'), objectUrl: 'blob:d', name: 'x.pdf', size: '1 KB', type: 'VOG', linkTo: '', expiresAt: '2027-03-31' }])
    })
    act(() => result.current.setItemType(0, 'CV'))
    act(() => result.current.uploadAll())
    await waitFor(() => expect(mockedPost).toHaveBeenCalled())
    expect((mockedPost.mock.calls[0][1] as FormData).get('expires_at')).toBeNull()
  })

  it('link PATCH failure uses the generic server text; a storage 503 never yields the storage sentence', async () => {
    const mockedPatch = vi.mocked(api.patch)
    mockedPost.mockResolvedValue({ data: { data: { id: 'd4', name: 'e.pdf', size: 1 } } })
    mockedPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Koppelen mislukt.' } } })
    const { result } = renderHook(() => useCandidateDocuments(candidate))
    act(() => {
      result.current.setPending([{ file: new File(['x'], 'e.pdf'), objectUrl: 'blob:e', name: 'e.pdf', size: '1 KB', type: 'CV', linkTo: 'education:e1' }])
    })
    act(() => result.current.uploadAll())
    await waitFor(() => expect(mockedNotifyError).toHaveBeenCalledWith('Koppelen mislukt.'))
    expect(mockedPatch.mock.calls[0][0]).toBe('/candidates/c1/educations/e1')
    expect(mockedPatch.mock.calls[0][1]).toEqual({ document_id: 'd4' })
    mockedNotifyError.mockClear()
    mockedPatch.mockRejectedValue({ response: { status: 503, data: { code: 'storage_unavailable' } } })
    mockedPost.mockClear()
    act(() => {
      result.current.setPending([{ file: new File(['x'], 'f.pdf'), objectUrl: 'blob:f', name: 'f.pdf', size: '1 KB', type: 'CV', linkTo: 'education:e1' }])
    })
    act(() => result.current.uploadAll())
    await waitFor(() => expect(mockedNotifyError).toHaveBeenCalled())
    expect(mockedNotifyError.mock.calls[0][0]).not.toMatch(/storage|opslag/i)
  })
})
