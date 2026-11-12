/** proposalCvEnsureApi: asserts the REQUEST (route, multipart body, Idempotency-Key) and the clean/rejected/invalid outcomes of the synchronous scan. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/api'
import { storeProposalCv, findCleanProposalCv, ProposalCvNotCleanError } from './proposalCvEnsureApi'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})
const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const docs = (status: string) => ({ data: { data: [{ id: 'd1', type: 'proposal_cv', scan_status: status }] } })

beforeEach(() => vi.clearAllMocks())

describe('proposalCvEnsureApi', () => {
  it('POSTs cv_pdf + cv_variant to the proposal-cv route with an Idempotency-Key', async () => {
    post.mockResolvedValue({ data: { data: { id: 'd1', type: 'proposal_cv', scan_status: 'clean' } } })
    const out = await storeProposalCv({ applicationId: 'a1', blob: new Blob(['x']), variant: 'full' })
    expect(out).toEqual({ id: 'd1', scanStatus: 'clean' })
    const [route, body, config] = post.mock.calls[0] as [string, FormData, { headers: Record<string, string> }]
    expect(route).toBe('/applications/a1/proposal-cv')
    expect((body.get('cv_pdf') as File).name).toBe('cv-a1-full.pdf')
    expect((body.get('cv_pdf') as File).type).toBe('application/pdf')
    expect(body.get('cv_variant')).toBe('full')
    expect(config.headers['Idempotency-Key']).toBeTruthy()
  })

  it('throws a typed error for a row that is not clean or has no id', async () => {
    post.mockResolvedValue({ data: { data: { id: 'd1', scan_status: 'pending' } } })
    await expect(storeProposalCv({ applicationId: 'a1', blob: new Blob(['x']), variant: 'proposal' })).rejects.toMatchObject({ name: 'ProposalCvNotCleanError', reason: 'invalid' })
    post.mockResolvedValue({ data: { data: { scan_status: 'clean' } } })
    await expect(storeProposalCv({ applicationId: 'a1', blob: new Blob(['x']), variant: 'proposal' })).rejects.toBeInstanceOf(ProposalCvNotCleanError)
    post.mockResolvedValue({ data: { data: { id: 'd1', scan_status: 'rejected' } } })
    await expect(storeProposalCv({ applicationId: 'a1', blob: new Blob(['x']), variant: 'proposal' })).rejects.toMatchObject({ reason: 'rejected' })
  })

  it('findCleanProposalCv returns the newest clean proposal_cv row or null', async () => {
    get.mockResolvedValueOnce({ data: { data: [
      { id: 'o', type: 'proposal_cv', scan_status: 'clean', created_at: '2026-01-01' },
      { id: 'n', type: 'proposal_cv', scan_status: 'clean', created_at: '2026-02-01' },
      { id: 'x', type: 'cv', scan_status: 'clean', created_at: '2026-03-01' }] } })
    await expect(findCleanProposalCv('a1')).resolves.toBe('n')
    get.mockResolvedValueOnce(docs('pending'))
    await expect(findCleanProposalCv('a1')).resolves.toBeNull()
  })
})
