/**
 * useContractSend — pins the HF-CONTRACT-SEND-1 request (route, exact body,
 * Idempotency-Key) and the mapping of each coded 409 and a 422 (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import i18n from '@/i18n'
import { useContractSend } from './useContractSend'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn() } }
})
import api from '@/lib/api'
const post = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { post.mockReset(); i18n.changeLanguage('en') })

describe('useContractSend', () => {
  it('POSTs /matches/{id}/contract with an empty {} body and an Idempotency-Key', async () => {
    post.mockResolvedValue({ data: { contract_status: 'sending' } })
    const { result } = renderHook(() => useContractSend('m1'))
    let out: unknown
    await act(async () => { out = await result.current.send() })
    expect(post).toHaveBeenCalledWith('/matches/m1/contract', {},
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(out).toEqual({ ok: true, data: { contract_status: 'sending' } })
  })

  it.each([
    ['contract_in_flight', 'errors.contractInFlight'],
    ['contract_unconfirmed', 'errors.contractUnconfirmed'],
    ['contract_sent', 'errors.contractSent'],
    ['two_way_off', 'errors.twoWayOff'],
    ['helloflex_contract_type_unmapped', 'errors.helloflexContractTypeUnmapped'],
    ['helloflex_start_date_missing', 'errors.helloflexStartDateMissing'],
    ['helloflex_job_title_missing', 'errors.helloflexJobTitleMissing'],
    ['helloflex_zzp_not_supported', 'errors.helloflexZzpNotSupported'],
    ['helloflex_employer_unlinked', 'errors.helloflexEmployerUnlinked'],
    ['helloflex_candidate_unlinked', 'errors.helloflexCandidateUnlinked'],
  ])('maps the 409 code %s to its translated sentence', async (code, key) => {
    post.mockRejectedValue({ response: { status: 409, data: { code, message: 'raw server text' } } })
    const { result } = renderHook(() => useContractSend('m1'))
    let out: { ok: boolean; message?: string | null } = { ok: true }
    await act(async () => { out = await result.current.send() })
    expect(out.ok).toBe(false)
    // Language-agnostic: the shared i18n singleton may switch language between suites in one worker.
    expect(['en', 'nl'].map(lng => i18n.t(key, { ns: 'common', lng }))).toContain(out.message)
    expect(out.message).not.toBe(key)
    expect(out.message).not.toBe('raw server text')
  })

  it('interpolates branch_name for helloflex_branch_unlinked', async () => {
    post.mockRejectedValue({ response: { status: 409, data: { code: 'helloflex_branch_unlinked', branch_name: 'Utrecht', message: 'raw' } } })
    const { result } = renderHook(() => useContractSend('m1'))
    let out: { message?: string | null } = {}
    await act(async () => { out = (await result.current.send()) as typeof out })
    expect(['en', 'nl'].map(lng => i18n.t('errors.helloflexBranchUnlinked', { ns: 'common', lng, branch: 'Utrecht' }))).toContain(out.message)
    expect(out.message).toContain('Utrecht')
  })

  it('maps the code-less module 403 to the module-off sentence', async () => {
    post.mockRejectedValue({ response: { status: 403, data: { message: 'Deze module (hf) zit niet in het pakket' } } })
    const { result } = renderHook(() => useContractSend('m1'))
    let out: { message?: string | null } = {}
    await act(async () => { out = (await result.current.send()) as typeof out })
    expect(['en', 'nl'].map(lng => i18n.t('errors.helloflexModuleOff', { ns: 'common', lng }))).toContain(out.message)
  })

  it('returns 422 field errors per field', async () => {
    post.mockRejectedValue({ response: { status: 422, data: { errors: { start_date: ['Bad date'] } } } })
    const { result } = renderHook(() => useContractSend('m1'))
    let out: { ok: boolean; fieldErrors?: Record<string, string> } = { ok: true }
    await act(async () => { out = await result.current.send() })
    expect(out.fieldErrors).toEqual({ start_date: 'Bad date' })
  })

  it('shows our own sentence for a 5xx without a code, never the server text', async () => {
    post.mockRejectedValue({ response: { status: 500, data: { message: 'Interne fout' } } })
    const { result } = renderHook(() => useContractSend('m1'))
    let out: { message?: string | null } = { message: null }
    await act(async () => { out = (await result.current.send()) as typeof out })
    expect(['en', 'nl'].map(lng => i18n.t('drawer.contractSend.error', { ns: 'matches', lng }))).toContain(out.message)
  })
})
