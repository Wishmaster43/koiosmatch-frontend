/** useApplicationDrawerActions · owner, score and custom-field handlers (split from useApplicationDrawerActions.test.ts; fixtures in useApplicationDrawerActions.testKit.ts). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { useApplicationDrawerActions } from './useApplicationDrawerActions'
import type { Application } from '@/types/application'
import type { Id } from '@/types/common'
import { FUNNEL, USERS, app, detail, t } from './useApplicationDrawerActions.testKit'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn(), patch: vi.fn(), get: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'

const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>

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

// OPTIMISTIC-REVERT-1 (audit 2026-07-27): handleOwner/handleAdjustScore/handleUpdateCustomFields
// used to end in a bare toast on failure, leaving the optimistic write on screen as if it had
// saved. These tests assert the SEAM (request body) and the revert of BOTH state slices.
describe('useApplicationDrawerActions · handleOwner', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends owner_id as the request body', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app()], { users: USERS })
    act(() => { result.current.actions.handleOwner(1, 'u2') })
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { owner_id: 'u2' })
  })

  it('keeps the new owner when the server accepts', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app()], { users: USERS })
    act(() => { result.current.actions.handleOwner(1, 'u2') })
    await waitFor(() => expect(result.current.applications[0].owner.id).toBe('u2'))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the owner in both the row and the open drawer, and reports the server message, when the PATCH FAILS', async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Geen rechten' } } })
    const initial = app()
    const { result } = harness([initial], { users: USERS })
    // Preload the open drawer with the SAME pre-edit owner, to prove BOTH slices revert.
    act(() => { result.current.actions.setSelected(detail({ id: 1, owner: initial.owner })) })
    act(() => { result.current.actions.handleOwner(1, 'u2') })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.applications[0].owner).toEqual(initial.owner)
    expect(result.current.actions.selected?.owner).toEqual(initial.owner)
    expect(notifyError).toHaveBeenCalledWith('Geen rechten')
  })

  it('clears the owner when called with null, sending { owner_id: null } as the request body', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const withOwner = app({ owner: { id: 'u2', name: 'Nieuwe Recruiter', initials: 'NR', color: null } })
    const { result } = harness([withOwner], { users: USERS })
    act(() => { result.current.actions.handleOwner(1, null) })
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { owner_id: null })
    // The UI model shows an unassigned owner (empty object with all null/empty fields)
    expect(result.current.applications[0].owner).toEqual({ id: null, name: '', initials: '', color: null })
  })

  it('reverts the owner when clearing fails, restoring the previous owner in both slices', async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Koppeling bezet' } } })
    const withOwner = app({ owner: { id: 'u2', name: 'Nieuwe Recruiter', initials: 'NR', color: null } })
    const { result } = harness([withOwner], { users: USERS })
    act(() => { result.current.actions.setSelected(detail({ id: 1, owner: withOwner.owner })) })
    act(() => { result.current.actions.handleOwner(1, null) })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    // Both slices revert to the original owner
    expect(result.current.applications[0].owner).toEqual(withOwner.owner)
    expect(result.current.actions.selected?.owner).toEqual(withOwner.owner)
    expect(notifyError).toHaveBeenCalledWith('Koppeling bezet')
  })
})

describe('useApplicationDrawerActions · handleAdjustScore', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('sends match_score and match_criteria as the request body', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app({ score: 40 })])
    act(() => { result.current.actions.handleAdjustScore(1, { score: 90, criteria: [] }) })
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { match_score: 90, match_criteria: [] })
  })

  it('keeps the new score when the server accepts', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app({ score: 40 })])
    act(() => { result.current.actions.handleAdjustScore(1, { score: 90, criteria: [] }) })
    await waitFor(() => expect(result.current.applications[0].score).toBe(90))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('reverts the score in both the row and the open drawer, and reports the server message, when the PATCH FAILS', async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Ongeldige score' } } })
    const { result } = harness([app({ score: 40 })])
    act(() => { result.current.actions.setSelected(detail({ id: 1, score: 40 })) })
    act(() => { result.current.actions.handleAdjustScore(1, { score: 90, criteria: [] }) })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.applications[0].score).toBe(40)
    expect(result.current.actions.selected?.score).toBe(40)
    expect(notifyError).toHaveBeenCalledWith('Ongeldige score')
  })
})

describe('useApplicationDrawerActions · handleUpdateCustomFields', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('merges the patch into customFields and sends the WHOLE map as the request body', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app()])
    act(() => { result.current.actions.setSelected(detail({ id: 1, customFields: { shift: 'day' } })) })
    act(() => { result.current.actions.handleUpdateCustomFields(1, { region: 'noord' }) })
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    expect(apiPatch).toHaveBeenCalledWith('/applications/1', { custom_fields: { shift: 'day', region: 'noord' } })
  })

  it('keeps the new custom fields when the server accepts', async () => {
    apiPatch.mockResolvedValue({ data: {} })
    const { result } = harness([app()])
    act(() => { result.current.actions.setSelected(detail({ id: 1, customFields: { shift: 'day' } })) })
    act(() => { result.current.actions.handleUpdateCustomFields(1, { region: 'noord' }) })
    await waitFor(() => expect(result.current.actions.selected?.customFields).toEqual({ shift: 'day', region: 'noord' }))
    expect(notifyError).not.toHaveBeenCalled()
  })

  it("reverts the open drawer's custom fields and reports the server message, when the PATCH FAILS", async () => {
    apiPatch.mockRejectedValue({ response: { status: 422, data: { message: 'Veld ongeldig' } } })
    const { result } = harness([app()])
    act(() => { result.current.actions.setSelected(detail({ id: 1, customFields: { shift: 'day' } })) })
    act(() => { result.current.actions.handleUpdateCustomFields(1, { region: 'noord' }) })
    await waitFor(() => expect(notifyError).toHaveBeenCalled())
    expect(result.current.actions.selected?.customFields).toEqual({ shift: 'day' })
    expect(notifyError).toHaveBeenCalledWith('Veld ongeldig')
  })
})
