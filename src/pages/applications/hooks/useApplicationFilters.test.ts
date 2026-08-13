/**
 * useApplicationFilters — server filterParams (F-6, W27). Covers: the
 * include_archived/bucket wiring (the "Gearchiveerd" quick-view must ask the
 * server to REVEAL detached rows and must not be narrowed by the bucket param
 * while doing so — matchesFilters isolates the archived view client-side
 * instead); the interview busy/paused quick-views; the W27 multi-select array
 * filters (phase/vacancy/owner/source/customer, verified against
 * ApplicationQuery.php); the NUMMER-1 reference-number fast path; the
 * candidate_ids deep-link scope; and the branch filter. §13: every assertion
 * below checks the REQUEST SHAPE (filterParams), never just that a setter fired.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'

// usePageMemory persists in a module-level Map keyed by string, so a real
// import would leak filter state across the `it()`s in this file (unrelated
// to the behaviour under test) — stub it as a plain useState, same contract.
vi.mock('@/lib/usePageMemory', () => ({
  usePageMemory: (_key: string, initial: unknown) =>
    useState(typeof initial === 'function' ? (initial as () => unknown)() : initial),
}))

import { useApplicationFilters } from './useApplicationFilters'

describe('useApplicationFilters — server filterParams', () => {
  it('sends no include_archived by default', () => {
    const { result } = renderHook(() => useApplicationFilters())
    expect(result.current.filterParams.include_archived).toBeUndefined()
    expect(result.current.bucketParam).toBe('active')
  })

  it('sends include_archived=1 once the archived quick-view is toggled on', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setShowArchived(true) })
    expect(result.current.filterParams.include_archived).toBe(1)
  })

  it('drops the bucket param while showArchived is on (the reveal must not be narrowed by it)', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setShowArchived(true) })
    expect(result.current.bucketParam).toBeUndefined()
  })

  it('matchesFilters isolates the archived rows client-side once showArchived is on', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setShowArchived(true) })
    expect(result.current.matchesFilters({ archived: true, bucket: 'active' })).toBe(true)
    expect(result.current.matchesFilters({ archived: false, bucket: 'active' })).toBe(false)
  })

  it('hides archived rows from the default (non-archived) view', () => {
    const { result } = renderHook(() => useApplicationFilters())
    expect(result.current.matchesFilters({ archived: true, bucket: 'active' })).toBe(false)
  })
})

// INTERVIEW-PHASE-1: the v1 "In interview" quick-view sends the server's own
// universal category filter (busy/completed/disqualified/none) directly.
// PLACED-1 (2026-08-14): the 4th bucket-donut segment has no server bucket value
// of its own (ApplicationQuery's enum stays active|matched|rejected) — it rides
// the real 'matched' bucket plus a `has_match=1` narrowing param.
describe('useApplicationFilters — placed bucket segment (PLACED-1)', () => {
  it('sends bucket=matched + has_match=1 once the placed segment is picked', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setBucket('placed') })
    expect(result.current.bucketParam).toBe('matched')
    expect(result.current.filterParams.has_match).toBe(1)
  })

  it('drops has_match once the bucket is cleared back to active', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setBucket('placed') })
    act(() => { result.current.setBucket('active') })
    expect(result.current.bucketParam).toBe('active')
    expect(result.current.filterParams.has_match).toBeUndefined()
  })

  it('drops the bucket/has_match narrowing while showArchived reveals the trash', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setBucket('placed'); result.current.setShowArchived(true) })
    expect(result.current.bucketParam).toBeUndefined()
    expect(result.current.filterParams.has_match).toBeUndefined()
  })

  it('matchesFilters narrows to matched rows that also carry hasMatch', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setBucket('placed') })
    expect(result.current.matchesFilters({ bucket: 'matched', hasMatch: true })).toBe(true)
    expect(result.current.matchesFilters({ bucket: 'matched', hasMatch: false })).toBe(false)
    expect(result.current.matchesFilters({ bucket: 'active', hasMatch: true })).toBe(false)
  })
})

describe('useApplicationFilters — interview quick-view (INTERVIEW-PHASE-1)', () => {
  it('sends no interview_status by default', () => {
    const { result } = renderHook(() => useApplicationFilters())
    expect(result.current.filterParams.interview_status).toBeUndefined()
  })

  it('sends interview_status=busy once the quick-view is toggled on', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setInterviewBusy(true) })
    expect(result.current.filterParams.interview_status).toBe('busy')
  })

  it('flips anyFilterActive on, and clearAllFilters resets it', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setInterviewBusy(true) })
    expect(result.current.anyFilterActive).toBe(true)
    act(() => { result.current.clearAllFilters() })
    expect(result.current.interviewBusy).toBe(false)
    expect(result.current.filterParams.interview_status).toBeUndefined()
  })
})

// INTERVIEW-PHASE-1 / W27: the new "Paused" quick-view — a second, independent
// server-side category filter (mutual exclusivity is enforced by the PAGE's
// click handlers, not the hook — see ApplicationsPage — so this hook just
// verifies its own precedence when both happen to be true).
describe('useApplicationFilters — interview paused quick-view (W27)', () => {
  it('sends interview_status=paused once the paused quick-view is toggled on', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setInterviewPaused(true) })
    expect(result.current.filterParams.interview_status).toBe('paused')
    expect(result.current.anyFilterActive).toBe(true)
  })

  it('busy wins if both flags are somehow true at once', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setInterviewBusy(true); result.current.setInterviewPaused(true) })
    expect(result.current.filterParams.interview_status).toBe('busy')
  })

  it('clearAllFilters resets the paused quick-view', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setInterviewPaused(true) })
    act(() => { result.current.clearAllFilters() })
    expect(result.current.interviewPaused).toBe(false)
    expect(result.current.filterParams.interview_status).toBeUndefined()
  })
})

// W27 (verified 2026-08-07 against ApplicationQuery.php): phase_key/vacancy_id/
// owner_id/source/customer_id are real ARRAY_FILTERS on the backend now — every
// multi-select sends the FULL array, not just a single value (the old BE gap).
describe('useApplicationFilters — multi-select array filters (W27)', () => {
  it('sends phase_key as the full array, even with more than one value', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedPhase(['applied', 'interview']) })
    expect(result.current.filterParams.phase_key).toEqual(['applied', 'interview'])
  })

  it('sends vacancy_id as the full array', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedVac(['v1', 'v2']) })
    expect(result.current.filterParams.vacancy_id).toEqual(['v1', 'v2'])
  })

  it('sends source as the full array', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedSource(['website', 'referral']) })
    expect(result.current.filterParams.source).toEqual(['website', 'referral'])
  })

  it('sends customer_id (client filter, new dimension) as the full array', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedClient(['c1', 'c2']) })
    expect(result.current.filterParams.customer_id).toEqual(['c1', 'c2'])
  })

  it('sends owner_id for real owner ids, server-side', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedOwner(['u1', 'u2']) })
    expect(result.current.filterParams.owner_id).toEqual(['u1', 'u2'])
  })

  // OWNER-NONE-SENTINEL-1 (verified live 2026-08-07, CMBE 5961c673): owner_id[]
  // now has a real IS-NULL sentinel — the client-only OWNER_NONE constant sends
  // as the wire value 'none' and narrows server-side, same as a real id.
  it('sends owner_id=[\'none\'] when the "No owner" sentinel is picked', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedOwner(['__none']) })
    expect(result.current.filterParams.owner_id).toEqual(['none'])
  })

  it('combines "No owner" with real ids in the same owner_id array', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedOwner(['u1', '__none']) })
    expect(result.current.filterParams.owner_id).toEqual(['u1', 'none'])
  })
})

// NUMMER-1 (mirrors useCandidateFilters): a well-formed reference number does an
// exact server-side `?ref=` lookup instead of the fuzzy `?search=`.
describe('useApplicationFilters — reference-number fast path (NUMMER-1)', () => {
  it('sends `search` for an ordinary free-text query', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setQuery('jane doe') })
    expect(result.current.filterParams.search).toBe('jane doe')
    expect(result.current.filterParams.ref).toBeUndefined()
    expect(result.current.refMode).toBe(false)
  })

  it('sends `ref` (not `search`) for a well-formed reference number', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setQuery('S-00123') })
    expect(result.current.filterParams.ref).toBe('S-00123')
    expect(result.current.filterParams.search).toBeUndefined()
    expect(result.current.refMode).toBe(true)
  })

  it('refMode short-circuits matchesFilters past every other dimension (mirrors the backend\'s own ref precedence)', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setBucket('active'); result.current.setSelectedPhase(['rejected']) })
    // A row that matches NEITHER the active bucket nor the selected phase still
    // passes once refMode is set — the exact ref lookup already found it server-side.
    expect(result.current.matchesFilters({ bucket: 'matched', phaseKey: 'hired' }, { refMode: true })).toBe(true)
  })
})

// 11.1: the candidates-bulk "manage per application" deep-link scope — sent to
// the server as `candidate_ids`, a real, working ApplicationQuery array filter
// (verified 2026-08-07 — ApplicationQuery.php:96-99/194), flips anyFilterActive,
// and is clearable.
describe('useApplicationFilters — candidate_ids deep-link scope (11.1)', () => {
  it('sends no candidate_ids by default', () => {
    const { result } = renderHook(() => useApplicationFilters())
    expect(result.current.filterParams.candidate_ids).toBeUndefined()
  })

  it('sends candidate_ids once the deep-link scope is set, and flips anyFilterActive', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedCandidateIds([1, 2, 3]) })
    expect(result.current.filterParams.candidate_ids).toEqual([1, 2, 3])
    expect(result.current.anyFilterActive).toBe(true)
  })

  it('clearAllFilters resets the deep-link scope', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedCandidateIds([1, 2]) })
    act(() => { result.current.clearAllFilters() })
    expect(result.current.selectedCandidateIds).toEqual([])
    expect(result.current.filterParams.candidate_ids).toBeUndefined()
  })
})

// VESTIGING-2: explicit branch filter (inherited from the candidate) — sent as a
// real server-side array filter (unlike phase_key/vacancy_id above, branch_id[]
// was delivered multi-value from day one, COORDINATION-LOG 28-07).
describe('useApplicationFilters — branch filter (VESTIGING-2)', () => {
  it('sends no branch_id by default', () => {
    const { result } = renderHook(() => useApplicationFilters())
    expect(result.current.filterParams.branch_id).toBeUndefined()
  })

  it('sends branch_id as an array once one or more branches are picked, and flips anyFilterActive', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedBranch(['b1', 'b2']) })
    expect(result.current.filterParams.branch_id).toEqual(['b1', 'b2'])
    expect(result.current.anyFilterActive).toBe(true)
  })

  it('clearAllFilters resets the branch pick', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setSelectedBranch(['b1']) })
    act(() => { result.current.clearAllFilters() })
    expect(result.current.selectedBranch).toEqual([])
    expect(result.current.filterParams.branch_id).toBeUndefined()
  })
})

// D6: the dashboard's "too long in stage" / "missing appointment" tiles land here
// via ApplicationsPage's own semantic { attention } intent-seeding effect — this
// asserts the REQUEST the hook produces from that intent (§13: never just a setter).
describe('useApplicationFilters — D6 dashboard attention intent', () => {
  it('sends no attention filter by default', () => {
    const { result } = renderHook(() => useApplicationFilters())
    expect(result.current.filterParams.too_long_in_stage).toBeUndefined()
    expect(result.current.filterParams.missing_appointment).toBeUndefined()
  })

  it('sends too_long_in_stage=1 for the tooLongInStage intent', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setAttention('tooLongInStage') })
    expect(result.current.filterParams.too_long_in_stage).toBe(1)
    expect(result.current.anyFilterActive).toBe(true)
  })

  it('sends missing_appointment=1 for the missingAppointment intent', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setAttention('missingAppointment') })
    expect(result.current.filterParams.missing_appointment).toBe(1)
  })

  it('clearAllFilters resets the attention intent', () => {
    const { result } = renderHook(() => useApplicationFilters())
    act(() => { result.current.setAttention('tooLongInStage') })
    act(() => { result.current.clearAllFilters() })
    expect(result.current.attention).toBeNull()
    expect(result.current.filterParams.too_long_in_stage).toBeUndefined()
  })
})
