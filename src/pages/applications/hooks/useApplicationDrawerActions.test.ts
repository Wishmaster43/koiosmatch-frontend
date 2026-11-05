/**
 * useApplicationDrawerActions — REJECT-HONEST-1 regression coverage (audit 2026-07-25).
 * handleReject used to end in `.catch(() => {})`: a refused reject (422 on a removed
 * reason, lost permission, workflow failure) left the row AND the drawer showing
 * "Afgewezen" while nothing was rejected and no message went out. These tests assert
 * the SEAM, not a callback: the exact request body, the reconcile from the response,
 * and the revert + error toast on failure (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useApplicationDrawerActions } from './useApplicationDrawerActions'
import type { Application } from '@/types/application'
import type { LookupItem } from '@/context/LookupsContext'
import type { Id } from '@/types/common'
import { FUNNEL, app, t } from './useApplicationDrawerActions.testKit'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn(), patch: vi.fn(), get: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'

const post = api.post as unknown as ReturnType<typeof vi.fn>
const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

// Harness with real state so the optimistic update → reconcile/revert is observable.
// `opts.users` is only needed by the handleOwner tests; every other suite keeps the
// original empty default so existing behaviour stays unchanged.
function harness(initial: Application[], opts: { users?: Array<{ id: Id; name: string }> } = {}) {
  return renderHook(() => {
    const [applications, setApplications] = useState<Application[]>(initial)
    const [, setTotal] = useState(initial.length)
    const actions = useApplicationDrawerActions({
      applications, wideRows: [], setApplications, setTotal,
      funnelTypes: FUNNEL, users: opts.users ?? [], bucket: 'active',
      decorate: <T,>(a: T) => a, t,
    })
    return { applications, actions }
  })
}

describe('useApplicationDrawerActions · handleReject', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends the reason id and note as the request body', async () => {
    post.mockResolvedValue({ data: { id: 1, phase_key: 'rejected' } })
    const { result } = harness([app()])
    act(() => { result.current.actions.handleReject(1, { reason_id: 'r-7', reason_label: 'Te ver reizen', note: '<p>toelichting</p>' }) })
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post).toHaveBeenCalledWith('/applications/1/reject', { reason_id: 'r-7', note: '<p>toelichting</p>' })
  })

  it('keeps the rejected phase and confirms when the server accepts', async () => {
    post.mockResolvedValue({ data: { id: 1, phase_key: 'rejected' } })
    const { result } = harness([app()])
    act(() => { result.current.actions.handleReject(1, { reason_id: 'r-7', reason_label: 'Te ver reizen', note: '' }) })
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled())
    expect(result.current.applications[0].phaseKey).toBe('rejected')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the row and reports the server message when the reject FAILS', async () => {
    post.mockRejectedValue({ response: { status: 422, data: { message: 'Reden bestaat niet meer' } } })
    const { result } = harness([app()])
    act(() => { result.current.actions.handleReject(1, { reason_id: 'gone', reason_label: 'Weg', note: '' }) })
    // Optimistic first, then the failure must put it back — never leave a fake rejection.
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.applications[0].phaseKey).toBe('applied')
    expect(result.current.applications[0].bucket).toBe('active')
    expect(notifySuccess).not.toHaveBeenCalled()
    expect(notifyError).toHaveBeenCalledWith('Reden bestaat niet meer')
  })
})

// DRILL-REFRESH-AUDIT-1 verdict: Danny's F5 case was root-fixed 23-08
// (REFRESH-FIX-2 / invalidateCandidate); the handler below ALREADY merged the
// edit into both surfaces (since 25-07). This pin keeps that invariant from
// regressing — an Opus round measured that a proposed extra "race guard" here
// would itself pin stale names across reopens, so none exists by design.
describe('useApplicationDrawerActions · handleCandidateUpdated (DRILL-REFRESH-AUDIT-1)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('merges the new name into the open drawer detail immediately (no F5 needed)', async () => {
    apiGet.mockResolvedValue({ data: { id: 1, candidate_id: 9, candidate: { name: 'Test kandidaat' } } })
    const { result } = harness([app()])
    act(() => { result.current.actions.selectApplication(app()) })
    await waitFor(() => expect(result.current.actions.selected).not.toBeNull())
    await waitFor(() => expect(result.current.actions.selected?.candidateId).toBe(9))
    act(() => { result.current.actions.handleCandidateUpdated(9, { candidateName: 'Isa van der Groen', candidateFunction: 'Verpleegkundige' }) })
    // Both surfaces update from the same handler — row AND the open drawer detail.
    expect(result.current.applications[0].candidateName).toBe('Isa van der Groen')
    expect(result.current.actions.selected?.candidateName).toBe('Isa van der Groen')
  })

})

// V-appdetail-2: a move onto a requires_appointment phase for a row with no
// appointment planned yet warns first (never blocks) — every other move stays
// exactly as before, unintercepted.
describe('useApplicationDrawerActions · handleMove (V-appdetail-2 appointment warn)', () => {
  const FUNNEL_APPT: LookupItem[] = [
    { value: 'applied', label: 'Gesolliciteerd', color: 'slate' },
    { value: 'invited', label: 'Uitgenodigd', color: 'purple', requires_appointment: true },
  ]
  function harnessAppt(initial: Application[]) {
    return renderHook(() => {
      const [applications, setApplications] = useState<Application[]>(initial)
      const [, setTotal] = useState(initial.length)
      const actions = useApplicationDrawerActions({
        applications, wideRows: [], setApplications, setTotal,
        funnelTypes: FUNNEL_APPT, users: [], bucket: 'active',
        decorate: <T,>(a: T) => a, t,
      })
      return { applications, actions }
    })
  }

  beforeEach(() => { vi.clearAllMocks() })

  it('holds the move as pending instead of moving immediately, and never PATCHes yet', () => {
    const { result } = harnessAppt([app({ phaseKey: 'applied', missingAppointment: true } as Partial<Application>)])
    act(() => result.current.actions.handleMove(1, 'invited'))
    expect(result.current.applications[0].phaseKey).toBe('applied') // not moved yet
    expect(apiPatch).not.toHaveBeenCalled()
    expect(result.current.actions.pendingMove).toEqual({ id: 1, phaseKey: 'invited', phaseLabel: 'Uitgenodigd' })
  })

  it('confirming the pending move proceeds with the exact same PATCH an unintercepted move would send', async () => {
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = harnessAppt([app({ phaseKey: 'applied', missingAppointment: true } as Partial<Application>)])
    act(() => result.current.actions.handleMove(1, 'invited'))
    act(() => result.current.actions.confirmPendingMove())
    expect(result.current.applications[0].phaseKey).toBe('invited')
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { phase_key: 'invited' })
    expect(result.current.actions.pendingMove).toBeNull()
  })

  it('cancelling drops the pending move — the application stays on its current phase', () => {
    const { result } = harnessAppt([app({ phaseKey: 'applied', missingAppointment: true } as Partial<Application>)])
    act(() => result.current.actions.handleMove(1, 'invited'))
    act(() => result.current.actions.cancelPendingMove())
    expect(result.current.actions.pendingMove).toBeNull()
    expect(result.current.applications[0].phaseKey).toBe('applied')
    expect(apiPatch).not.toHaveBeenCalled()
  })

  it('a move that is NOT missing an appointment proceeds immediately, unintercepted', () => {
    apiPatch.mockResolvedValue({ data: { data: {} } })
    const { result } = harnessAppt([app({ phaseKey: 'applied', missingAppointment: false } as Partial<Application>)])
    act(() => result.current.actions.handleMove(1, 'invited'))
    expect(result.current.applications[0].phaseKey).toBe('invited')
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { phase_key: 'invited' })
    expect(result.current.actions.pendingMove).toBeNull()
  })
})
