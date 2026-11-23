/**
 * useCandidateErase (CANDIDATE-ERASE-FE-1): the request seam of the candidate anonymise
 * (REQUEST-ASSERT-1: route, body and quiet statuses), the open-match refusal reader
 * (ERASURE-OPEN-MATCH-1) and the hook's success and failure paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import { CANDIDATE_HAS_OPEN_MATCH, eraseCandidate, openMatchConflictMessage, useCandidateErase } from './useCandidateErase'

vi.mock('@/lib/api', async importOriginal => ({ ...(await importOriginal<typeof import('@/lib/api')>()), default: { post: vi.fn() } }))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const t = (key: string, opts?: { count: number }) => i18n.t(key, { ns: 'candidates', ...opts })
const openMatch409 = (context?: { open_matches: number }) =>
  ({ response: { status: 409, data: { code: CANDIDATE_HAS_OPEN_MATCH, message: 'Open match.', ...(context ? { context } : {}) } } })

describe('eraseCandidate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs /candidates/{id}/erase with exactly { password, mode: anonymize } and keeps 403/409/422 out of the dev toast', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'Personal data erased.' } })
    const res = await eraseCandidate('c1', 'geheim')
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/candidates/c1/erase', { password: 'geheim', mode: 'anonymize' }, { quietStatuses: [403, 409, 422] })
    expect(res).toEqual({ message: 'Personal data erased.' })
  })

  it('adds close_open_matches: true only when the caller resolves the open-match refusal', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'ok' } })
    await eraseCandidate('c1', 'geheim', true)
    expect(api.post).toHaveBeenCalledWith('/candidates/c1/erase', { password: 'geheim', mode: 'anonymize', close_open_matches: true }, { quietStatuses: [403, 409, 422] })
  })
})

describe('openMatchConflictMessage', () => {
  it('translates the 409 candidate_has_open_match with the open count (singular and plural)', () => {
    expect(openMatchConflictMessage(openMatch409({ open_matches: 1 }), t)).toBe(t('erase.openMatch', { count: 1 }))
    expect(openMatchConflictMessage(openMatch409({ open_matches: 2 }), t)).toBe(t('erase.openMatch', { count: 2 }))
    expect(t('erase.openMatch', { count: 1 })).not.toBe(t('erase.openMatch', { count: 2 }))
    expect(t('erase.openMatch', { count: 2 })).toContain('2')
  })

  it('falls back to the countless sentence when the body carries no context (a non-staff audience), never the server text', () => {
    expect(openMatchConflictMessage(openMatch409(), t)).toBe(t('erase.openMatchUnknown'))
    expect(openMatchConflictMessage(openMatch409(), t)).not.toContain('Open match.')
  })

  it('returns null for every other error so the dialog maps it as usual', () => {
    expect(openMatchConflictMessage({ response: { status: 409, data: { code: 'in_use', blocking: [] } } }, t)).toBeNull()
    expect(openMatchConflictMessage({ response: { status: 403 } }, t)).toBeNull()
    expect(openMatchConflictMessage(new Error('network'), t)).toBeNull()
  })
})

describe('useCandidateErase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('confirm POSTs the plain anonymise, toasts the done copy, closes and hands the id to onErased', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'ok' } })
    const onErased = vi.fn()
    const { result } = renderHook(() => useCandidateErase('c1', 'Gewist.', onErased))
    act(() => result.current.open())
    expect(result.current.erasing).toBe(true)
    await act(async () => { await result.current.confirm('geheim') })
    expect(api.post).toHaveBeenCalledWith('/candidates/c1/erase', { password: 'geheim', mode: 'anonymize' }, { quietStatuses: [403, 409, 422] })
    expect(notifySuccess).toHaveBeenCalledWith('Gewist.')
    expect(onErased).toHaveBeenCalledWith('c1')
    expect(result.current.erasing).toBe(false)
  })

  it('confirm with resolveConflict re-posts with close_open_matches: true', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: 'ok' } })
    const { result } = renderHook(() => useCandidateErase('c1', 'Gewist.', vi.fn()))
    await act(async () => { await result.current.confirm('geheim', { resolveConflict: true }) })
    expect(api.post).toHaveBeenCalledWith('/candidates/c1/erase', { password: 'geheim', mode: 'anonymize', close_open_matches: true }, { quietStatuses: [403, 409, 422] })
  })

  it('a rejected POST rethrows (the dialog maps it) and keeps the dialog open; nothing is toasted', async () => {
    vi.mocked(api.post).mockRejectedValue(openMatch409({ open_matches: 1 }))
    const onErased = vi.fn()
    const { result } = renderHook(() => useCandidateErase('c1', 'Gewist.', onErased))
    act(() => result.current.open())
    await expect(act(async () => { await result.current.confirm('geheim') })).rejects.toMatchObject({ response: { status: 409 } })
    expect(result.current.erasing).toBe(true)
    expect(notifySuccess).not.toHaveBeenCalled()
    expect(onErased).not.toHaveBeenCalled()
  })

  it('confirm without an id does nothing', async () => {
    const { result } = renderHook(() => useCandidateErase(null, 'Gewist.', vi.fn()))
    await act(async () => { await result.current.confirm('geheim') })
    expect(api.post).not.toHaveBeenCalled()
  })
})
