/**
 * useCandidateStatus — "potlood op de statuswissel" (Danny 2026-07-20, job A):
 * openStatusEdit seeds the status modal PREFILLED from the candidate's current
 * status reason/return date, and confirmStatus for that edit-in-place path must
 * PATCH only the reason/date — never re-send `status`/`statusChangedAt` for a
 * status that didn't actually change. A real status TRANSITION still carries both.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCandidateStatus } from './useCandidateStatus'
import type { Candidate } from '@/types/candidate'

// Tenant lookups: 'sick' requires both a reason and a return date (flag-driven,
// mirrors the §3B status axis); 'available' carries neither flag.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    phases: [
      // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant phase lookup colour (mirrors DEFAULT_PHASES)
      { value: 'lead', label: 'Lead', color: '#94A3B8' },
      // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant phase lookup colour (mirrors DEFAULT_PHASES)
      { value: 'candidate', label: 'Candidate', color: '#79B58E' },
    ],
    statuses: [
      // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant status lookup colour (mirrors DEFAULT_STATUSES)
      { value: 'available', label: 'Available', color: '#4CAF50' },
      // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant status lookup colour (renamed requires_match fixture, heraudit r4)
      { value: 'ingezet', label: 'Ingezet', color: '#6E8FD6', requires_match: true },
      // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant status lookup colour (mirrors DEFAULT_STATUSES)
      { value: 'sick', label: 'Sick', color: '#F59E0B', requires_reason: true, expects_return_date: true },
      // eslint-disable-next-line no-restricted-syntax -- seed DATA: tenant status lookup colour (mirrors DEFAULT_STATUSES)
      { value: 'blacklist', label: 'Blacklist', color: '#EF4444', requires_reason: true, is_blacklist: true },
    ],
    phaseMeta: (v?: string | null) => ({ label: v ?? '', color: '#000' }),
  }),
}))
// Keep the real getJsonSetting/getBoolSetting (candidateStatusInfo's makeRequiredComplete
// uses the former; this file's own blacklist-toggle tests use the latter); only the
// settings blob itself is test-controlled (same pattern as AddCandidateModal.test).
// BLACKLIST-TOGGLE-1: module-level mutable blob so individual tests can flip the
// `blacklist_reason_required` tenant setting without re-mocking per test.
let mockSettings: Record<string, unknown> = {}
vi.mock('@/lib/settings/useAllSettings', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/settings/useAllSettings')>()
  return { ...actual, useAllSettings: () => mockSettings }
})
// Network-backed hooks (Placed prompt) are irrelevant here — stub to no-ops.
vi.mock('./useCreateMatch', () => ({ useCreateMatch: () => ({ createMatch: vi.fn(), creating: false }) }))
vi.mock('./useVacancyOptions', () => ({ useVacancyOptions: () => [] }))

// Sick candidate with an existing reason + return date — the case the pencil edits.
const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  id: 'c1', phase: 'candidate', status: 'sick',
  statusReason: 'Griep', statusReturnDate: '2026-08-01T00:00:00.000Z', blacklistReason: null,
  statusChangedAt: null, preferences: {},
  ...over,
} as unknown as Candidate)

// Reset the tenant settings blob before every test — leaking a flipped
// `blacklist_reason_required` between tests would silently mask a bug.
beforeEach(() => { mockSettings = {} })

describe('useCandidateStatus · openStatusEdit (prefilled entry point)', () => {
  it('seeds the modal from the CURRENT status reason/date, without touching the status', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useCandidateStatus({ c: candidate(), onUpdate }))
    act(() => { result.current.openStatusEdit() })
    expect(result.current.statusModal).toEqual({
      target: 'sick', reason: 'Griep', date: '2026-08-01', needReason: true, needDate: true, isBlacklist: false,
    })
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('re-picking the current flagged status from the meta dropdown opens the same prefilled edit', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useCandidateStatus({ c: candidate(), onUpdate }))
    act(() => { result.current.changeStatus('sick') }) // same as current — edit, not a transition
    expect(result.current.statusModal?.target).toBe('sick')
    expect(result.current.statusModal?.reason).toBe('Griep')
    expect(onUpdate).not.toHaveBeenCalled()
  })
})

describe('useCandidateStatus · confirmStatus PATCH body', () => {
  it('editing the CURRENT status only PATCHes reason/date — no status or statusChangedAt key', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useCandidateStatus({ c: candidate(), onUpdate }))
    act(() => { result.current.openStatusEdit() })
    act(() => { result.current.setStatusModal(m => m && ({ ...m, reason: 'Griep, nu met koorts' })) })
    act(() => { result.current.confirmStatus() })

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const [id, patch] = onUpdate.mock.calls[0]
    expect(id).toBe('c1')
    expect(patch).toEqual({
      statusReason: 'Griep, nu met koorts', statusReturnDate: '2026-08-01',
      preferences: { available_from: '2026-08-01' }, // STATUS-DATE-SYNC-1 (existing, unrelated to this fix)
    })
    expect(patch).not.toHaveProperty('status')
    expect(patch).not.toHaveProperty('statusChangedAt')
  })

  it('an ACTUAL status transition still carries status + statusChangedAt', () => {
    const onUpdate = vi.fn()
    const c = candidate({ status: 'available', statusReason: null, statusReturnDate: null })
    const { result } = renderHook(() => useCandidateStatus({ c, onUpdate }))
    act(() => { result.current.changeStatus('sick') }) // different from current → opens the (empty) prompt
    act(() => { result.current.setStatusModal(m => m && ({ ...m, reason: 'Griep', date: '2026-08-01' })) })
    act(() => { result.current.confirmStatus() })

    const [, patch] = onUpdate.mock.calls[0]
    expect(patch).toMatchObject({ status: 'sick', statusReason: 'Griep', statusReturnDate: '2026-08-01' })
    expect(patch).toHaveProperty('statusChangedAt')
  })
})

describe('useCandidateStatus · canEditStatusReason (flag-driven, never slug-hardcoded)', () => {
  it('is true when the current status flags require a reason/date', () => {
    const { result } = renderHook(() => useCandidateStatus({ c: candidate() }))
    expect(result.current.canEditStatusReason).toBe(true)
  })

  it('is true when the flags do not require it but the candidate already carries a value worth editing', () => {
    const c = candidate({ status: 'available', statusReason: null, statusReturnDate: '2026-08-01T00:00:00.000Z' })
    const { result } = renderHook(() => useCandidateStatus({ c }))
    expect(result.current.canEditStatusReason).toBe(true)
  })

  it('is false when there is nothing to edit (no flags, no values)', () => {
    const c = candidate({ status: 'available', statusReason: null, statusReturnDate: null, blacklistReason: null })
    const { result } = renderHook(() => useCandidateStatus({ c }))
    expect(result.current.canEditStatusReason).toBe(false)
  })
})

// BLACKLIST-TOGGLE-1: needReason on a blacklist transition follows the tenant
// setting `blacklist_reason_required` (default ON when the key is absent).
describe('useCandidateStatus · blacklist reason-required follows the tenant setting', () => {
  it('needReason is true for a blacklist transition when the setting is on (\'1\')', () => {
    mockSettings = { blacklist_reason_required: '1' }
    const onUpdate = vi.fn()
    const c = candidate({ status: 'available', statusReason: null, statusReturnDate: null })
    const { result } = renderHook(() => useCandidateStatus({ c, onUpdate }))
    act(() => { result.current.changeStatus('blacklist') })
    expect(result.current.statusModal?.needReason).toBe(true)
    expect(result.current.statusModal?.isBlacklist).toBe(true)
  })

  it('needReason is false for a blacklist transition when the setting is off (\'0\')', () => {
    mockSettings = { blacklist_reason_required: '0' }
    const onUpdate = vi.fn()
    const c = candidate({ status: 'available', statusReason: null, statusReturnDate: null })
    const { result } = renderHook(() => useCandidateStatus({ c, onUpdate }))
    act(() => { result.current.changeStatus('blacklist') })
    expect(result.current.statusModal?.needReason).toBe(false)
    expect(result.current.statusModal?.isBlacklist).toBe(true)
  })

  it('defaults needReason to true when the setting key is absent', () => {
    mockSettings = {}
    const onUpdate = vi.fn()
    const c = candidate({ status: 'available', statusReason: null, statusReturnDate: null })
    const { result } = renderHook(() => useCandidateStatus({ c, onUpdate }))
    act(() => { result.current.changeStatus('blacklist') })
    expect(result.current.statusModal?.needReason).toBe(true)
  })
})

// Heraudit r4 HIGH regression: confirming the match prompt writes the PICKED
// requires_match status value — never the literal 'placed' slug (a tenant may
// carry a renamed/second flagged status; the axes model keys on the FLAG).
describe('useCandidateStatus · requires_match writes the picked value', () => {
  it('threads a renamed flagged status through the placed prompt into the PATCH', async () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useCandidateStatus({ c: candidate({ status: 'available' }), onUpdate }))
    act(() => { result.current.changeStatus('ingezet') })
    expect(result.current.matchPrompt).toBe(true)
    act(() => { result.current.setMatchChoice('m-1') })
    await act(async () => { await result.current.confirmPlacedMatch() })
    expect(onUpdate).toHaveBeenCalledWith('c1', { status: 'ingezet', match_id: 'm-1' })
  })
})

// STATUS-OVERRIDE-REVERT-1: the drawer's local status override used to survive a
// rejected PATCH (the page-level revert can't reach it) — a refused status stayed
// showing in the picker while the record itself reverted. onUpdate now resolves
// true/false, and the override clears itself on false.
describe('useCandidateStatus · STATUS-OVERRIDE-REVERT-1 (override clears on a rejected PATCH)', () => {
  it('changeStatus reverts the override when onUpdate resolves false', async () => {
    const onUpdate = vi.fn().mockResolvedValue(false)
    const c = candidate({ status: 'sick' }) // flag-less target ('available') so the PATCH fires straight away
    const { result } = renderHook(() => useCandidateStatus({ c, onUpdate }))
    act(() => { result.current.changeStatus('available') })
    expect(result.current.currentStatus).toBe('available') // optimistic
    await waitFor(() => expect(result.current.currentStatus).toBe('sick')) // reverted to the record's own value
  })

  it('changeStatus keeps the override when onUpdate resolves true (saved)', async () => {
    const onUpdate = vi.fn().mockResolvedValue(true)
    const c = candidate({ status: 'sick' })
    const { result } = renderHook(() => useCandidateStatus({ c, onUpdate }))
    act(() => { result.current.changeStatus('available') })
    await act(async () => { await Promise.resolve() })
    expect(result.current.currentStatus).toBe('available')
  })
})
