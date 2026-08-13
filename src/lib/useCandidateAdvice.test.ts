/**
 * useCandidateAdvice — the ONE resolver shared by the table column and the
 * drawer. ADVICE-KEY-1 (2026-07-27): the real backend engine sends `reason` as
 * an i18n KEY, never a rendered sentence — verify it resolves through t()
 * (with interpolation) instead of printing the raw key, that a sourceless
 * backend value is ignored in favour of the local rule engine, and that a
 * backend `action: 'none'` yields null.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import '@/i18n'
import { useCandidateAdvice } from './useCandidateAdvice'
import type { Candidate } from '@/types/candidate'

// Controlled lookups — only statusMeta/phases matter to the resolver.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ phases: [{ value: 'lead' }], statusMeta: () => ({ is_blacklist: false }) }),
}))
// No API-backed loader in this test — the stale-months setting falls back to its default (6).
vi.mock('@/lib/settings/useAllSettings', () => ({
  useAllSettings: () => ({}),
  getNumberSetting: (_s: unknown, _key: string, fallback: number) => fallback,
}))

// Minimal Candidate stub — only the fields the hook/engine read matter here.
function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 1,
    lifecycle: 'active',
    archived: false,
    phase: 'candidate',
    stage: 'applied',
    pools: [{ name: 'Pool A' }],
    lastContactAt: '2026-07-01',
    lastContactDate: '2026-07-01',
    koiosAdvice: null,
    ...overrides,
  } as Candidate
}

describe('useCandidateAdvice — backend engine (source tagged)', () => {
  it('resolves a dotted, whitespace-free reason KEY through t(), interpolating params, instead of printing the raw key', () => {
    const { result } = renderHook(() => useCandidateAdvice())
    const c = makeCandidate({
      koiosAdvice: { action: 'contact', reason: 'advice.reason.stale_contact', source: 'rules' },
    })
    const advice = result.current(c)
    expect(advice).not.toBeNull()
    // Real (nl) translation, never the literal key, with the stale-months threshold interpolated.
    expect(advice!.reason).toBe('Langer dan 6 maanden geen contact geregistreerd. Plan een belmoment.')
    expect(advice!.reason).not.toBe('advice.reason.stale_contact')
  })

  it('resolves the action label the same way as the local engine when the backend sends none', () => {
    const { result } = renderHook(() => useCandidateAdvice())
    const c = makeCandidate({
      koiosAdvice: { action: 'add_to_pool', reason: 'advice.reason.no_pool', source: 'rules' },
    })
    const advice = result.current(c)
    expect(advice!.label).toBe('Voeg toe aan pool')
  })

  it('falls back to the raw value (never empty) when the key is unrecognised', () => {
    const { result } = renderHook(() => useCandidateAdvice())
    const c = makeCandidate({
      koiosAdvice: { action: 'contact', reason: 'advice.reason.unknown_future_key', source: 'rules' },
    })
    const advice = result.current(c)
    expect(advice!.reason).toBe('advice.reason.unknown_future_key')
  })

  it('leaves a non-key reason (no dot, or contains whitespace) untouched', () => {
    const { result } = renderHook(() => useCandidateAdvice())
    const c = makeCandidate({
      koiosAdvice: { action: 'contact', reason: 'Some plain sentence.', source: 'rules' },
    })
    const advice = result.current(c)
    expect(advice!.reason).toBe('Some plain sentence.')
  })

  it('a backend action of "none" yields null even with a tagged source', () => {
    const { result } = renderHook(() => useCandidateAdvice())
    const c = makeCandidate({ koiosAdvice: { action: 'none', source: 'rules' } })
    expect(result.current(c)).toBeNull()
  })
})

describe('useCandidateAdvice — honest gate (no source → local engine answers)', () => {
  it('ignores a sourceless backend advice and falls back to the local rule engine', () => {
    const { result } = renderHook(() => useCandidateAdvice())
    // Backend advice carries no `source` — the seeded-random legacy shape — so the
    // local engine (a fully "up to date" candidate here) must answer instead, i.e. null.
    const c = makeCandidate({ koiosAdvice: { action: 'contact', reason: 'Random seeded text' } })
    expect(result.current(c)).toBeNull()
  })

  it('the local engine still fires its own advice when nothing backend-tagged is present', () => {
    const { result } = renderHook(() => useCandidateAdvice())
    const c = makeCandidate({ lastContactAt: null, lastContactDate: null, koiosAdvice: null })
    const advice = result.current(c)
    expect(advice).not.toBeNull()
    expect(advice!.source).toBe('rules')
    expect(advice!.action).toBe('contact')
  })
})
