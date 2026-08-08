/**
 * useOutreachDetail — mutation seam tests for the two G29/G30 additions
 * (setTargetNote, assignTargets). §13: assert the REQUEST (method/route/body),
 * never only that a callback fired. The pre-existing setters (status/outcome/
 * owner) are exercised indirectly via OutreachDrawer/TargetsTab already; this
 * file only covers the new mutations.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import api from '@/lib/api'
import { useOutreachDetail } from './useOutreachDetail'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

const campaign = { id: 'c1', name: 'Bellijst Zorg', targets: [{ id: 't1', status: 'todo', note: null }] }

afterEach(() => vi.clearAllMocks())

describe('useOutreachDetail · setTargetNote (G30)', () => {
  it('PATCHes /outreach-targets/{id} with the note, optimistically, and reverts on failure', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: campaign } })
    vi.mocked(api.patch).mockRejectedValue(new Error('422'))
    const { result } = renderHook(() => useOutreachDetail('c1'))
    await waitFor(() => expect(result.current.detail?.targets?.[0].note).toBe(null))

    await act(async () => {
      await expect(result.current.setTargetNote('t1', 'Bel na 17u terug')).rejects.toThrow()
    })
    // THE SEAM: exact route + body.
    expect(api.patch).toHaveBeenCalledWith('/outreach-targets/t1', { note: 'Bel na 17u terug' })
    // Reverted after the rejected request — never left showing an unsaved value as saved.
    expect(result.current.detail?.targets?.[0].note).toBe(null)
  })

  it('keeps the optimistic note once the PATCH succeeds', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: campaign } })
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { id: 't1', note: 'Bel na 17u terug' } } })
    const { result } = renderHook(() => useOutreachDetail('c1'))
    await waitFor(() => expect(result.current.detail).not.toBeNull())

    await act(async () => { await result.current.setTargetNote('t1', 'Bel na 17u terug') })
    expect(result.current.detail?.targets?.[0].note).toBe('Bel na 17u terug')
  })
})

describe('useOutreachDetail · assignTargets (G29 — BELLIJST-ASSIGN-1)', () => {
  it('POSTs target_ids + recruiter_ids to /outreach-campaigns/{id}/targets/assign and replaces detail from the response', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: campaign } })
    const freshCampaign = { id: 'c1', name: 'Bellijst Zorg', targets: [{ id: 't1', status: 'todo', assignee: { id: 'r1', name: 'Nora' } }] }
    vi.mocked(api.post).mockResolvedValue({ data: { data: freshCampaign, meta: { updated: ['t1'], skipped: [] } } })
    const { result } = renderHook(() => useOutreachDetail('c1'))
    await waitFor(() => expect(result.current.detail).not.toBeNull())

    let summary
    await act(async () => { summary = await result.current.assignTargets(['t1'], ['r1']) })

    // THE SEAM: exact route + body shape the backend validates (BELLIJST-ASSIGN-1).
    expect(api.post).toHaveBeenCalledWith('/outreach-campaigns/c1/targets/assign', { target_ids: ['t1'], recruiter_ids: ['r1'] })
    // Honest result summary — never a bare "done".
    expect(summary).toEqual({ updated: ['t1'], skipped: [] })
    // Detail state replaced by the fresh server truth (assignee now attached).
    expect(result.current.detail?.targets?.[0].assignee).toEqual({ id: 'r1', name: 'Nora' })
  })

  it('reports skipped ids honestly when some targets do not resolve (foreign/stale id)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: campaign } })
    vi.mocked(api.post).mockResolvedValue({ data: { data: campaign, meta: { updated: [], skipped: ['t9'] } } })
    const { result } = renderHook(() => useOutreachDetail('c1'))
    await waitFor(() => expect(result.current.detail).not.toBeNull())

    let summary
    await act(async () => { summary = await result.current.assignTargets(['t9'], ['r1']) })
    expect(summary).toEqual({ updated: [], skipped: ['t9'] })
  })
})
