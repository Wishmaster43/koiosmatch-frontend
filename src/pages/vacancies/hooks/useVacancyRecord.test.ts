/**
 * useVacancyRecord · updateVacancy's PATCH-response re-sync (verdict finding 1,
 * HIGH fix). `matchWeights` already re-synced its two fields from the
 * authoritative response instead of the optimistic local patch; the same is now
 * true for `interviewWorkflowId` — this hook only sends the id, but the server
 * resolves the nested `interviewWorkflow` ref (agent + name), so trusting the
 * optimistic patch alone would leave `detail.interviewWorkflow` stale (null)
 * while `interviewWorkflowId` already flipped, which is exactly the "— / —"
 * bug VacancyAgentTab hit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { useVacancyRecord } from './useVacancyRecord'
import api from '@/lib/api'
import type { Vacancy } from '@/types/vacancy'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>

const vacancyRow = { id: 'v1', title: 'Verpleegkundige' } as Vacancy
const rawDetail = (over: Record<string, unknown> = {}) => ({ id: 'v1', title: 'Verpleegkundige', ai_agent: null, ...over })

const setup = () => {
  const t = ((k: string) => k) as unknown as TFunction
  return renderHook(() => useVacancyRecord({
    setVacancies: vi.fn(), setTotal: vi.fn(), statusMeta: () => ({ label: '', color: '' }),
    users: [], customers: [], t,
  }))
}

beforeEach(() => { mockGet.mockReset(); mockPatch.mockReset() })

describe('useVacancyRecord · updateVacancy interview-workflow re-sync', () => {
  it('re-syncs interviewWorkflowId + the nested interviewWorkflow ref from the PATCH response, not the optimistic patch', async () => {
    mockGet.mockResolvedValue({ data: { data: rawDetail({ interview_workflow_id: null }) } })
    const { result: hook } = setup()
    act(() => { hook.current.selectVacancy(vacancyRow) })
    await waitFor(() => expect(hook.current.detail).not.toBeNull())

    const linkedWorkflow = { id: 'wf-1', name: 'Kelly-Helpende', folder: { id: 'fo-1', name: 'Kelly' }, agent: { id: 'a1', name: 'Kelly' } }
    mockPatch.mockResolvedValue({ data: { data: rawDetail({ interview_workflow_id: 'wf-1', interview_workflow: linkedWorkflow }) } })

    let ok: boolean | undefined
    await act(async () => { ok = await hook.current.updateVacancy('v1', { interviewWorkflowId: 'wf-1' }) })

    expect(ok).toBe(true)
    expect(mockPatch).toHaveBeenCalledWith('/vacancies/v1', { interview_workflow_id: 'wf-1' })
    // The nested ref rides along with the id — never left stale/null.
    expect(hook.current.detail?.interviewWorkflowId).toBe('wf-1')
    expect(hook.current.detail?.interviewWorkflow?.name).toBe('Kelly-Helpende')
    expect(hook.current.detail?.interviewWorkflow?.agent?.name).toBe('Kelly')
  })

  it('a failed PATCH reports false (caller must not read it as a success)', async () => {
    mockGet.mockResolvedValue({ data: { data: rawDetail({ interview_workflow_id: null }) } })
    const { result: hook } = setup()
    act(() => { hook.current.selectVacancy(vacancyRow) })
    await waitFor(() => expect(hook.current.detail).not.toBeNull())

    mockPatch.mockRejectedValue(new Error('boom'))
    let ok: boolean | undefined
    await act(async () => { ok = await hook.current.updateVacancy('v1', { interviewWorkflowId: 'wf-1' }) })

    // §3 no fake affordance: the caller (VacancyAgentTab) gates on this boolean,
    // never on the optimistic local state, which — unchanged pre-existing
    // behaviour, mirrors the matchWeights branch — is not rolled back here.
    expect(ok).toBe(false)
  })
})
