/**
 * proposeRequest — the multipart body (strings, '1'/'0' booleans, cv_pdf File), the
 * 5 MB guard and the posted request (route, FormData body, Idempotency-Key header).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assertProposalCvSize, buildProposeFormData, postPropose, PROPOSAL_CV_MAX_BYTES, ProposalCvTooLargeError } from './proposeRequest'

const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn(() => Promise.resolve({ data: {} })) }))
vi.mock('@/lib/api', () => ({ default: { post: apiPost } }))

const fields = { contact_id: 'ct1', cv_variant: 'full', subject: 'S', body: '<p>B</p>', send: true, sender_user_id: null }

describe('proposeRequest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('carries scalars as strings, booleans as 1/0 and cv_pdf as a named PDF File; omits null/undefined', () => {
    const form = buildProposeFormData({ ...fields, send: false, force: true }, new Blob(['pdf']), '7')
    expect(form.get('contact_id')).toBe('ct1')
    expect(form.get('subject')).toBe('S')
    expect(form.get('send')).toBe('0')
    expect(form.get('force')).toBe('1')
    expect(form.has('sender_user_id')).toBe(false)
    const file = form.get('cv_pdf') as File
    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('application/pdf')
    expect(file.name).toBe('cv-7-full.pdf')
    expect(buildProposeFormData(fields, new Blob(['x']), '7').has('force')).toBe(false)
  })

  it('size guard passes at the cap and throws above it', () => {
    expect(() => assertProposalCvSize(new Blob([new Uint8Array(PROPOSAL_CV_MAX_BYTES)]))).not.toThrow()
    expect(() => assertProposalCvSize(new Blob([new Uint8Array(PROPOSAL_CV_MAX_BYTES + 1)]))).toThrow(ProposalCvTooLargeError)
  })

  it('posts to /applications/<id>/propose with a FormData body and an Idempotency-Key', async () => {
    await postPropose(7, fields, new Blob(['pdf']))
    const call = apiPost.mock.calls[0] as unknown as [string, FormData, { headers: Record<string, string>; quietStatuses: number[] }]
    expect(call[0]).toBe('/applications/7/propose')
    expect(call[1]).toBeInstanceOf(FormData)
    expect(call[2].headers['Idempotency-Key']).toEqual(expect.any(String))
    expect(call[2].quietStatuses).toEqual([409])
  })
})
