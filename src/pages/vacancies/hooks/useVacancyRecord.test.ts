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
import type { Dispatch, SetStateAction } from 'react'
import { useVacancyRecord } from './useVacancyRecord'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { Vacancy } from '@/types/vacancy'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
const mockPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const mockNotifyError = notifyError as unknown as ReturnType<typeof vi.fn>

const vacancyRow = { id: 'v1', title: 'Verpleegkundige' } as Vacancy
const rawDetail = (over: Record<string, unknown> = {}) => ({ id: 'v1', title: 'Verpleegkundige', ai_agent: null, ...over })

const setup = (setVacancies: Dispatch<SetStateAction<Vacancy[]>> = vi.fn()) => {
  const t = ((k: string) => k) as unknown as TFunction
  return renderHook(() => useVacancyRecord({
    setVacancies, setTotal: vi.fn(), statusMeta: () => ({ label: '', color: '' }),
    users: [], customers: [], t,
  }))
}

beforeEach(() => { mockGet.mockReset(); mockPatch.mockReset(); mockNotifyError.mockReset() })

describe('useVacancyRecord · selectVacancy detail-fetch error signal', () => {
  it('a failed detail GET notifies the user instead of leaving a silent empty drawer', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    const { result: hook } = setup()
    act(() => { hook.current.selectVacancy(vacancyRow) })

    // Bug class fix regression: this used to be a completely empty catch — no
    // signal at all, the drawer sat stuck on the light row forever.
    await waitFor(() => expect(mockNotifyError).toHaveBeenCalled())
    expect(hook.current.detail).toBeNull()
  })
})

describe('useVacancyRecord · updateVacancy interview-workflow re-sync', () => {
  it('re-syncs interviewWorkflowId + the nested interviewWorkflow ref from the PATCH response, not the optimistic patch', async () => {
    mockGet.mockResolvedValue({ data: { data: rawDetail({ interview_workflow_id: null }) } })
    const { result: hook } = setup()
    act(() => { hook.current.selectVacancy(vacancyRow) })
    await waitFor(() => expect(hook.current.detail).not.toBeNull())

    // WFB-08: WorkflowResource never emits a folder object — no `folder` key.
    const linkedWorkflow = { id: 'wf-1', name: 'Kelly-Helpende', agent: { id: 'a1', name: 'Kelly' } }
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

// ONIX D-003: a plain patch (e.g. a branch assignment outside the user's grants)
// used to fall back to a generic toast — the server's own 403 reason is now
// surfaced instead, and the promise resolves false so a caller never reads it
// as a success.
describe('useVacancyRecord · updateVacancy surfaces the server\'s own error message', () => {
  it('a 403 branch-not-assignable PATCH notifies with the server message, not the generic fallback', async () => {
    mockGet.mockResolvedValue({ data: { data: rawDetail() } })
    const { result: hook } = setup()
    act(() => { hook.current.selectVacancy(vacancyRow) })
    await waitFor(() => expect(hook.current.detail).not.toBeNull())

    mockPatch.mockRejectedValue({ response: { status: 403, data: { message: 'Geen recht op deze vestiging' } } })
    let ok: boolean | undefined
    await act(async () => { ok = await hook.current.updateVacancy('v1', { branchId: 'x', branchName: 'X' }) })

    expect(mockNotifyError).toHaveBeenCalledWith('Geen recht op deze vestiging')
    expect(ok).toBe(false)
  })
})

// ONIX N-007: a double-click on the restore banner must POST the restore route
// exactly once; `restoring` disables the banner's button while it runs.
describe('useVacancyRecord · restoreVacancy re-entrancy guard', () => {
  it('two synchronous restoreVacancy calls POST /vacancies/{id}/restore once; restoring resets after settle', async () => {
    let resolvePost: (() => void) | undefined
    mockPatch.mockReset()
    const mockPost = api.post as unknown as ReturnType<typeof vi.fn>
    mockPost.mockImplementation(() => new Promise(res => { resolvePost = () => res({}) }))
    const { result: hook } = setup()

    act(() => {
      hook.current.restoreVacancy('v1')
      hook.current.restoreVacancy('v1')
    })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/vacancies/v1/restore', undefined, expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
    expect(hook.current.restoring).toBe(true)

    await act(async () => { resolvePost?.(); await Promise.resolve() })
    await waitFor(() => expect(hook.current.restoring).toBe(false))
  })
})

describe('useVacancyRecord · updateVacancy koiosChoosesLeads (LEADS-AI-1)', () => {
  it('PATCHes the key and re-syncs the switch and the stale count state from the response', async () => {
    mockGet.mockResolvedValue({ data: { data: rawDetail({ koios_chooses_leads: false }) } })
    const setVacancies = vi.fn()
    const { result: hook } = setup(setVacancies)
    act(() => { hook.current.selectVacancy(vacancyRow) })
    await waitFor(() => expect(hook.current.detail).not.toBeNull())
    mockPatch.mockResolvedValue({ data: { data: rawDetail({ koios_chooses_leads: true, match_count_state: { computed_at: null, is_stale: true } }) } })

    let ok: boolean | undefined
    await act(async () => { ok = await hook.current.updateVacancy('v1', { koiosChoosesLeads: true }) })

    expect(ok).toBe(true)
    expect(mockPatch).toHaveBeenCalledWith('/vacancies/v1', { koios_chooses_leads: true })
    expect(hook.current.detail?.koiosChoosesLeads).toBe(true)
    expect(hook.current.detail?.matchCountState?.isStale).toBe(true)
    expect(hook.current.selected?.matchCountState?.isStale).toBe(true)
    const rows = setVacancies.mock.calls.at(-1)?.[0]([{ id: 'v1', koiosChoosesLeads: false }])
    expect(rows[0].koiosChoosesLeads).toBe(true)
  })

  it('a rejected PATCH reverts the switch and resolves false', async () => {
    mockGet.mockResolvedValue({ data: { data: rawDetail({ koios_chooses_leads: false }) } })
    const setVacancies = vi.fn()
    const { result: hook } = setup(setVacancies)
    act(() => { hook.current.selectVacancy(vacancyRow) })
    await waitFor(() => expect(hook.current.detail?.koiosChoosesLeads).toBe(false))
    mockPatch.mockRejectedValue(new Error('boom'))

    let ok: boolean | undefined
    await act(async () => { ok = await hook.current.updateVacancy('v1', { koiosChoosesLeads: true }) })

    expect(ok).toBe(false)
    expect(hook.current.detail?.koiosChoosesLeads).toBe(false)
    expect(hook.current.selected?.koiosChoosesLeads).toBe(false)
    const rows = setVacancies.mock.calls.at(-1)?.[0]([{ id: 'v1', koiosChoosesLeads: true }])
    expect(rows[0].koiosChoosesLeads).toBe(false)
    expect(mockNotifyError).toHaveBeenCalled()
  })
})
