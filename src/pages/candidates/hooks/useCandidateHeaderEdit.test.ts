/**
 * useCandidateHeaderEdit — NAAMDELEN-1 regression coverage. Measured live 28-07:
 * the header pencil used to seed firstname/lastname via `name.split(' ')`, which
 * assigns the last word as surname and drops the tussenvoegsel entirely — so
 * opening and saving a candidate named "Jan van der Berg" silently rewrote the
 * name to "Jan Berg". This asserts the fixed seam end to end: the form reads the
 * REAL first_name/middle_name/last_name mapCandidate now exposes, and an
 * untouched save still forwards the tussenvoegsel in the onUpdate patch (§13 —
 * assert the request body, never only that a callback fired).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCandidateHeaderEdit } from './useCandidateHeaderEdit'
import type { Candidate } from '@/types/candidate'

// Minimal candidate as mapCandidate would produce it for "Jan van der Berg"
// (first_name "Jan", middle_name "van der", last_name "Berg" from the API).
const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  id: 'c1', name: 'Jan van der Berg',
  firstname: 'Jan', middleName: 'van der', lastname: 'Berg', title: 'Verpleegkundige',
  ...over,
} as unknown as Candidate)

describe('useCandidateHeaderEdit · tussenvoegsel preservation (NAAMDELEN-1)', () => {
  it('seeds the form from the real name parts — the tussenvoegsel field reads "van der"', () => {
    const { result } = renderHook(() => useCandidateHeaderEdit(candidate(), vi.fn()))
    act(() => { result.current.startHeaderEdit() })
    expect(result.current.hf('firstname')).toBe('Jan')
    expect(result.current.hf('middleName')).toBe('van der')
    expect(result.current.hf('lastname')).toBe('Berg')
  })

  it('saving WITHOUT touching anything still forwards the tussenvoegsel in the patch', () => {
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useCandidateHeaderEdit(candidate(), onUpdate))
    act(() => { result.current.startHeaderEdit() })
    act(() => { result.current.saveHeader() })
    expect(onUpdate).toHaveBeenCalledWith('c1', expect.objectContaining({
      firstname: 'Jan', middleName: 'van der', lastname: 'Berg',
    }))
    // The composed name must not collapse the tussenvoegsel either.
    expect(onUpdate.mock.calls[0][1].name).toBe('Jan van der Berg')
  })

  it('never falls back to name.split(\' \') when the real parts are missing — no guessed rewrite', () => {
    // A candidate with no first_name/middle_name/last_name at all (API omitted them);
    // the form must show BLANK fields, never a guess derived from `name`.
    const bare = candidate({ firstname: undefined, middleName: undefined, lastname: undefined })
    const onUpdate = vi.fn()
    const { result } = renderHook(() => useCandidateHeaderEdit(bare, onUpdate))
    act(() => { result.current.startHeaderEdit() })
    expect(result.current.hf('firstname')).toBe('')
    expect(result.current.hf('middleName')).toBe('')
    expect(result.current.hf('lastname')).toBe('')
  })
})
