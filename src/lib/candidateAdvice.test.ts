import { describe, it, expect } from 'vitest'
import { deriveCandidateAdvice } from './candidateAdvice'
import type { Candidate } from '@/types/candidate'

// Minimal Candidate stub — only the fields the engine reads matter for these tests.
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
    ...overrides,
  } as Candidate
}

const opts = { staleMonths: 6, entryPhase: 'lead', isBlacklist: false, now: new Date('2026-07-25') }

describe('deriveCandidateAdvice', () => {
  it('gives no advice on an archived dossier (lifecycle)', () => {
    const c = makeCandidate({ lifecycle: 'archived' })
    expect(deriveCandidateAdvice(c, opts)).toEqual({ action: 'none', reasonKey: 'koios.reasons.none' })
  })

  it('gives no advice on an archived dossier (archived flag)', () => {
    const c = makeCandidate({ archived: true })
    expect(deriveCandidateAdvice(c, opts)).toEqual({ action: 'none', reasonKey: 'koios.reasons.none' })
  })

  it('gives no advice on a blacklisted candidate', () => {
    const c = makeCandidate()
    expect(deriveCandidateAdvice(c, { ...opts, isBlacklist: true })).toEqual({ action: 'none', reasonKey: 'koios.reasons.none' })
  })

  it('advises contact when there is no last contact at all', () => {
    const c = makeCandidate({ lastContactAt: null, lastContactDate: null })
    expect(deriveCandidateAdvice(c, { ...opts, isBlacklist: false })).toEqual({ action: 'contact', reasonKey: 'koios.reasons.neverContacted' })
  })

  it('advises contact when the last contact is older than the stale threshold', () => {
    const c = makeCandidate({ lastContactAt: '2025-12-01', lastContactDate: '2025-12-01' })
    expect(deriveCandidateAdvice(c, { ...opts, isBlacklist: false })).toEqual({
      action: 'contact', reasonKey: 'koios.reasons.staleContact', reasonParams: { months: 6 },
    })
  })

  it('priority: a never-contacted lead returns contact, not plan_intake', () => {
    const c = makeCandidate({ phase: 'lead', stage: '', lastContactAt: null, lastContactDate: null })
    expect(deriveCandidateAdvice(c, { ...opts, isBlacklist: false }).action).toBe('contact')
  })

  it('advises plan_intake for a Lead with no application', () => {
    const c = makeCandidate({ phase: 'lead', stage: '' })
    expect(deriveCandidateAdvice(c, { ...opts, isBlacklist: false })).toEqual({ action: 'plan_intake', reasonKey: 'koios.reasons.leadNoApplication' })
  })

  it('advises add_to_pool when the candidate has no pools', () => {
    const c = makeCandidate({ pools: [] })
    expect(deriveCandidateAdvice(c, { ...opts, isBlacklist: false })).toEqual({ action: 'add_to_pool', reasonKey: 'koios.reasons.noPool' })
  })

  it('gives no advice when everything is up to date', () => {
    const c = makeCandidate()
    expect(deriveCandidateAdvice(c, { ...opts, isBlacklist: false })).toEqual({ action: 'none', reasonKey: 'koios.reasons.none' })
  })

  it('boundary: contact stays fresh one day under the stale-months cutoff', () => {
    // now = 2026-07-25, staleMonths = 6 -> cutoff month-boundary is 2026-01-25.
    const c = makeCandidate({ lastContactAt: '2026-01-26', lastContactDate: '2026-01-26' })
    expect(deriveCandidateAdvice(c, { ...opts, isBlacklist: false }).action).not.toBe('contact')
  })

  it('boundary: contact goes stale exactly at the cutoff', () => {
    const c = makeCandidate({ lastContactAt: '2026-01-25', lastContactDate: '2026-01-25' })
    expect(deriveCandidateAdvice(c, { ...opts, isBlacklist: false }).action).toBe('contact')
  })
})
