/**
 * useApplicationBulkActions — BULK-ROUTE-1 regression coverage: bulkSetPhase and
 * bulkDetach must call the real bulk routes (POST /applications/bulk/{stage,detach})
 * with `application_ids`, never the old per-id PATCH/DELETE loop. A skipped row in
 * the response (with a reason) must revert only that row and surface the reason in
 * the toast breakdown — this is what replaced the old all-or-nothing revert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useApplicationBulkActions } from './useApplicationBulkActions'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import type { LookupItem } from '@/context/LookupsContext'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notify: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }))
import api from '@/lib/api'
import { notify } from '@/lib/notify'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const notifyMock = notify as unknown as ReturnType<typeof vi.fn>
// Records interpolation params too, so the reason-breakdown assertion can inspect them.
const t = ((k: string, params?: Record<string, unknown>) => (params ? `${k}:${JSON.stringify(params)}` : k)) as unknown as import('i18next').TFunction

const FUNNEL: LookupItem[] = [
  { value: 'applied', label: 'Applied', color: 'slate' },
  { value: 'hired',    label: 'Hired',   color: 'slate', is_match: true },
]

const app = (overrides: Partial<Application> = {}): Application => ({
  id: 1, candidateId: 1, candidateName: 'Test candidate', candidateInitials: 'TC',
  vacancyId: 1, vacancyTitle: 'Nurse', client: 'Acme', customerId: 1, referenceNumber: 'S-1',
  score: null, task: '', phaseKey: 'applied', bucket: 'active', source: '',
  owner: { id: null, name: '', initials: '', color: null },
  candidateStatusLabel: '', candidateStatusColor: '', candidateStatus: '', candidatePhase: '',
  created: '', isNew: false, archived: false, deletedAt: null,
  ...overrides,
} as Application)

// Harness: real state, so we can observe the optimistic update → per-row reconcile.
function harness(initial: Application[]) {
  return renderHook(() => {
    const [applications, setApplications] = useState<Application[]>(initial)
    const [total, setTotal] = useState(initial.length)
    const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set())
    const actions = useApplicationBulkActions({ applications, setApplications, setTotal, selectedIds, setSelectedIds, funnelTypes: FUNNEL, t })
    return { applications, total, setSelectedIds, actions }
  })
}
const rowOf = (r: { result: { current: { applications: Application[] } } }, id: Id) => r.result.current.applications.find(a => a.id === id)

beforeEach(() => { post.mockReset(); notifyMock.mockReset() })

describe('useApplicationBulkActions · bulkDetach', () => {
  it('sends ONE POST to the bulk-detach route with application_ids + reason', async () => {
    post.mockResolvedValue({ data: { updated: [1, 2], skipped: [] } })
    const r = harness([app({ id: 1 }), app({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkDetach('No longer relevant'))
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/applications/bulk/detach', { application_ids: [1, 2], reason: 'No longer relevant' })
    await waitFor(() => expect(rowOf(r, 1)?.archived).toBe(true))
    expect(rowOf(r, 2)?.archived).toBe(true)
  })

  it('reverts only the rows the server skipped and shows the reason breakdown', async () => {
    post.mockResolvedValue({ data: { updated: [1], skipped: [{ id: 2, reason: 'permission_denied' }] } })
    const r = harness([app({ id: 1 }), app({ id: 2 })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkDetach('Duplicate'))
    expect(rowOf(r, 1)?.archived).toBe(true) // optimistic
    expect(rowOf(r, 2)?.archived).toBe(true) // optimistic
    await waitFor(() => expect(rowOf(r, 2)?.archived).toBe(false)) // reverted (skipped)
    expect(rowOf(r, 1)?.archived).toBe(true) // stays applied (updated)
    expect(r.result.current.total).toBe(1) // decremented once, not reverted for id 1
    expect(notifyMock).toHaveBeenCalledWith('warning', expect.stringContaining('bulk.partialResultReasoned'))
    const [, msg] = notifyMock.mock.calls[0]
    expect(msg).toContain('1 bulk.skipReasons.permission_denied')
  })

  it('reverts everything + decrements back on a hard request failure', async () => {
    post.mockRejectedValue(new Error('500'))
    const r = harness([app({ id: 1 })])
    act(() => r.result.current.setSelectedIds(new Set([1])))
    act(() => r.result.current.actions.bulkDetach('reason'))
    expect(r.result.current.total).toBe(0)
    await waitFor(() => expect(rowOf(r, 1)?.archived).toBe(false))
    expect(r.result.current.total).toBe(1)
  })

  it('is a no-op when nothing is selected — never calls the API with an empty id list', () => {
    const r = harness([app({ id: 1 })])
    act(() => r.result.current.actions.bulkDetach('reason'))
    expect(post).not.toHaveBeenCalled()
  })
})

describe('useApplicationBulkActions · bulkSetPhase', () => {
  it('sends ONE POST to the bulk-stage route with application_ids + phase_key', async () => {
    post.mockResolvedValue({ data: { updated: [1, 2], skipped: [] } })
    const r = harness([app({ id: 1, phaseKey: 'applied' }), app({ id: 2, phaseKey: 'applied' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetPhase('hired'))
    expect(rowOf(r, 1)?.phaseKey).toBe('hired')
    expect(rowOf(r, 1)?.bucket).toBe('matched')
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/applications/bulk/stage', { application_ids: [1, 2], phase_key: 'hired' })
  })

  it('reverts only the row the server skipped, keeps the rest, and reports the reason', async () => {
    post.mockResolvedValue({ data: { updated: [1], skipped: [{ id: 2, reason: 'already_on_phase' }] } })
    const r = harness([app({ id: 1, phaseKey: 'applied' }), app({ id: 2, phaseKey: 'applied' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetPhase('hired'))
    await waitFor(() => expect(rowOf(r, 2)?.phaseKey).toBe('applied')) // reverted
    expect(rowOf(r, 1)?.phaseKey).toBe('hired') // kept
    expect(notifyMock).toHaveBeenCalledWith('warning', expect.stringContaining('bulk.partialResultReasoned'))
  })

  it('reverts every touched row and reports failure when the request itself rejects', async () => {
    post.mockRejectedValue({ response: { status: 422 } })
    const r = harness([app({ id: 1, phaseKey: 'applied' }), app({ id: 2, phaseKey: 'applied' })])
    act(() => r.result.current.setSelectedIds(new Set([1, 2])))
    act(() => r.result.current.actions.bulkSetPhase('hired'))
    await waitFor(() => expect(rowOf(r, 1)?.phaseKey).toBe('applied'))
    expect(rowOf(r, 2)?.phaseKey).toBe('applied')
  })
})
