/** useEnsureProposalCv: short-circuit on an existing clean CV, full render/store path (synchronous scan), abort on unmount. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import api from '@/lib/api'
import { useEnsureProposalCv } from './useEnsureProposalCv'
import { buildProposalCvBlob } from '@/lib/proposalCv'
import * as ensureApi from './proposalCvEnsureApi'

const useTranslationMock = vi.fn((ns?: string) => ({ t: (k: string) => (ns === 'candidates' ? `candidates:${k}` : k) }))
vi.mock('react-i18next', () => ({ useTranslation: (ns?: string) => useTranslationMock(ns) }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/useCvSettings', () => ({ useCvSettings: () => ({ settings: {} }) }))
vi.mock('@/lib/settings/useAllSettings', () => ({ useAllSettings: () => ({}), getJsonSetting: () => ({ default_cv_variant: 'full' }) }))
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))
vi.mock('@/lib/proposalCv', async () => {
  const actual = await vi.importActual<typeof import('@/lib/proposalCv')>('@/lib/proposalCv')
  return { ...actual, buildProposalCvBlob: vi.fn() }
})
vi.mock('@/pages/candidates/data/mapCandidate', () => ({ mapCandidate: (x: unknown) => x }))
vi.mock('./proposalCvEnsureApi', async () => {
  const actual = await vi.importActual<typeof import('./proposalCvEnsureApi')>('./proposalCvEnsureApi')
  return { ...actual, findCleanProposalCv: vi.fn(), storeProposalCv: vi.fn() }
})
const get = vi.mocked(api.get)

beforeEach(() => vi.clearAllMocks())

describe('useEnsureProposalCv', () => {
  it('returns an existing clean CV without rendering or posting', async () => {
    vi.mocked(ensureApi.findCleanProposalCv).mockResolvedValue('old')
    const { result } = renderHook(() => useEnsureProposalCv())
    await expect(result.current.ensureProposalCv('a1')).resolves.toBe('old')
    expect(buildProposalCvBlob).not.toHaveBeenCalled()
    expect(ensureApi.storeProposalCv).not.toHaveBeenCalled()
  })

  it('loads application + candidate, renders, stores and returns the clean id', async () => {
    vi.mocked(ensureApi.findCleanProposalCv).mockResolvedValue(null)
    get.mockImplementation(async (url: string) => ({ data: { data: url === '/applications/a1' ? { candidate_id: 'c1' } : { id: 'c1' } } }) as never)
    vi.mocked(buildProposalCvBlob).mockResolvedValue(new Blob(['pdf']))
    vi.mocked(ensureApi.storeProposalCv).mockResolvedValue({ id: 'new', scanStatus: 'clean' })
    const { result } = renderHook(() => useEnsureProposalCv())
    await expect(result.current.ensureProposalCv('a1')).resolves.toBe('new')
    expect(get.mock.calls.map(c => c[0])).toEqual(['/applications/a1', '/candidates/c1'])
    expect(buildProposalCvBlob).toHaveBeenCalledWith(expect.objectContaining({ variant: 'full', locale: 'nl-NL' }))
    expect(ensureApi.storeProposalCv).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 'a1', variant: 'full' }))
    // The CV labeller resolves cv.* keys, so the t handed over must be the candidates-namespace one.
    expect(useTranslationMock).toHaveBeenCalledWith('candidates')
    const handed = vi.mocked(buildProposalCvBlob).mock.calls[0][0].t as unknown as (k: string) => string
    expect(handed('cv.contact')).toBe('candidates:cv.contact')
  })

  it('rejects with a human message when the store fails', async () => {
    vi.mocked(ensureApi.findCleanProposalCv).mockResolvedValue(null)
    get.mockResolvedValue({ data: { data: { candidate_id: 'c1' } } } as never)
    vi.mocked(buildProposalCvBlob).mockResolvedValue(new Blob(['pdf']))
    vi.mocked(ensureApi.storeProposalCv).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useEnsureProposalCv())
    await expect(result.current.ensureProposalCv('a1')).rejects.toThrow('notesAssist.proposeCv.prepareFailed')
  })

  it('translates a coded refusal and never shows the server sentence', async () => {
    vi.mocked(ensureApi.findCleanProposalCv).mockResolvedValue(null)
    get.mockResolvedValue({ data: { data: { candidate_id: 'c1' } } } as never)
    vi.mocked(buildProposalCvBlob).mockResolvedValue(new Blob(['pdf']))
    vi.mocked(ensureApi.storeProposalCv).mockRejectedValue({ response: { data: { code: 'cv_infected', message: 'NL zin' } } })
    const { result } = renderHook(() => useEnsureProposalCv())
    await expect(result.current.ensureProposalCv('a1')).rejects.toThrow('errors.cvInfected')
  })

  it('aborts the signal handed to the requests when the host unmounts', async () => {
    vi.mocked(ensureApi.findCleanProposalCv).mockResolvedValue(null)
    let signal: AbortSignal | undefined
    get.mockImplementation(async (_u: string, cfg?: { signal?: unknown }) => { signal = cfg?.signal as AbortSignal | undefined; return { data: { data: { candidate_id: 'c1' } } } as never })
    vi.mocked(buildProposalCvBlob).mockResolvedValue(new Blob(['pdf']))
    vi.mocked(ensureApi.storeProposalCv).mockResolvedValue({ id: 'n', scanStatus: 'clean' })
    const { result, unmount } = renderHook(() => useEnsureProposalCv())
    await result.current.ensureProposalCv('a1')
    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)
  })
})
