/**
 * useCandidateUpdate — ONIX K-011 (BE 7fe6b281): after a status PATCH the server clears
 * the reason / return date / blacklist reason the new status does not call for. The hook
 * adopts those columns from the server answer on ANY patch that carries `status`, and
 * keeps adopting only the patched keys for every other edit (a parallel edit survives).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCandidateUpdate, serverAdoptKeys, STATUS_CHANGE_SERVER_KEYS } from './useCandidateUpdate'
import type { Candidate } from '@/types/candidate'

// A sick candidate with a reason and a return date — the state K-011 clears.
const sick = { id: 'c1', status: 'sick', statusReason: 'Griep', statusReturnDate: '2026-10-20', blacklistReason: null, statusChangedAt: '2026-10-01T08:00:00Z' } as unknown as Candidate
// What the server answers after the move to "available": columns cleared, stamp renewed.
const serverAfter = { id: 'c1', status: 'available', statusReason: null, statusReturnDate: null, blacklistReason: null, blacklistReasonKey: null, statusChangedAt: '2026-10-05T12:00:00Z', name: 'Noud' } as unknown as Candidate

// Runs the hook with spy setters and a patchCandidate that answers `server` straight away.
function arrange(server: Candidate) {
  const setCandidates = vi.fn(); const setSelected = vi.fn(); const setDetail = vi.fn()
  const patchCandidate = vi.fn((_id, _patch, _revert, onServer: (c: Candidate) => void) => { onServer(server); return Promise.resolve(true) })
  const { result } = renderHook(() => useCandidateUpdate({ candidates: [sick], setCandidates, selected: sick, setSelected, detail: sick, setDetail, patchCandidate }))
  return { result, setDetail, patchCandidate }
}

// The last setDetail call is the server-adopt updater; apply it to the optimistic state.
const lastDetail = (setDetail: ReturnType<typeof vi.fn>, prev: Candidate) =>
  (setDetail.mock.calls[setDetail.mock.calls.length - 1][0] as (c: Candidate) => Candidate)(prev)

describe('serverAdoptKeys (K-011)', () => {
  it('adds the status-side columns only when the patch carries status', () => {
    expect(serverAdoptKeys(['status'])).toEqual(['status', ...STATUS_CHANGE_SERVER_KEYS])
    expect(serverAdoptKeys(['email'])).toEqual(['email'])
    expect(serverAdoptKeys(['status', 'statusReason'])).toEqual(['status', ...STATUS_CHANGE_SERVER_KEYS])
  })
})

describe('useCandidateUpdate · a status change adopts the cleared columns from the server (K-011)', () => {
  it('drops the stale reason and return date right after the PATCH answers', async () => {
    const { result, setDetail } = arrange(serverAfter)
    await result.current.updateCandidate('c1', { status: 'available' })
    const after = lastDetail(setDetail, { ...sick, status: 'available' } as Candidate)
    expect(after.statusReason).toBeNull()
    expect(after.statusReturnDate).toBeNull()
    expect(after.statusChangedAt).toBe('2026-10-05T12:00:00Z')
    // Only the status-side columns ride along: the unrelated server field stays untouched locally.
    expect((after as unknown as { name?: string }).name).toBeUndefined()
  })

  it('keeps adopting only the patched keys for a non-status edit', async () => {
    const { result, setDetail } = arrange({ ...serverAfter, email: 'noud@example.nl' } as unknown as Candidate)
    await result.current.updateCandidate('c1', { email: 'noud@example.nl' })
    const after = lastDetail(setDetail, { ...sick, email: 'noud@example.nl' } as unknown as Candidate)
    expect(after.statusReason).toBe('Griep')
    expect(after.statusReturnDate).toBe('2026-10-20')
  })
})
