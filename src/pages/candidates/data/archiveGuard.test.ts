/**
 * archiveGuard — regression tests for the archive/prullenbak interception
 * (§3B): the row-level pre-filter, the live-blockers fetch (which has to
 * re-check each nested application's phase_key since the candidate detail
 * only sends a label, not a slug — see the file header), the 409
 * forward-compat payload reader, and the two resolution calls.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import api from '@/lib/api'
import {
  needsLiveCheck, fetchLiveBlockers, normalizeLivePayload, liveFromError,
  resolveApplication, resolveMatch,
} from './archiveGuard'
import type { Candidate } from '@/types/candidate'
import type { LookupItem } from '@/context/LookupsContext'

// A tenant that renamed the funnel: 'hired' → 'aangenomen' (is_match) and
// 'rejected' → 'afgewezen' (is_rejected) — proves the flag drives the check,
// not the literal slug (A1 root-cause fix).
const RENAMED_FUNNEL: LookupItem[] = [
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'applied', label: 'Gesolliciteerd', color: '#94A3B8' },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'aangenomen', label: 'Aangenomen', color: '#79B58E', is_match: true },
  // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
  { value: 'afgewezen', label: 'Afgewezen', color: '#D98A8A', is_rejected: true },
]

// Keep the real unwrap/unwrapList (importActual) — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('needsLiveCheck', () => {
  it('is false for a candidate with no funnel stage and no placed status', () => {
    expect(needsLiveCheck({ stage: '', status: 'available' } as Candidate)).toBe(false)
  })
  it('is true for a non-terminal funnel stage', () => {
    expect(needsLiveCheck({ stage: 'proposal', status: 'available' } as Candidate)).toBe(true)
  })
  it('is false for a terminal funnel stage (hired/rejected) with no placed status', () => {
    expect(needsLiveCheck({ stage: 'hired', status: 'available' } as Candidate)).toBe(false)
    expect(needsLiveCheck({ stage: 'rejected', status: 'available' } as Candidate)).toBe(false)
  })
  it('is true when the deployability status is placed, regardless of stage', () => {
    expect(needsLiveCheck({ stage: '', status: 'placed' } as Candidate)).toBe(true)
  })
  it('is false for null/undefined candidates', () => {
    expect(needsLiveCheck(null)).toBe(false)
    expect(needsLiveCheck(undefined)).toBe(false)
  })

  // A1 root-cause: the literal 'hired'/'rejected' keys are ONLY a fallback seed —
  // a tenant-renamed funnel must resolve terminal-ness off the is_match/is_rejected
  // FLAG, never the slug.
  it('is flag-driven: a renamed terminal stage (is_match/is_rejected) is still terminal', () => {
    expect(needsLiveCheck({ stage: 'aangenomen', status: 'available' } as Candidate, RENAMED_FUNNEL)).toBe(false)
    expect(needsLiveCheck({ stage: 'afgewezen', status: 'available' } as Candidate, RENAMED_FUNNEL)).toBe(false)
  })
  it('is flag-driven: the literal "hired"/"rejected" slug is NOT special-cased once a custom lookup is passed', () => {
    // Under the renamed funnel, 'hired' is not a known value at all — it must be
    // treated as a non-terminal (unknown) stage, not silently matched by the old key.
    expect(needsLiveCheck({ stage: 'hired', status: 'available' } as Candidate, RENAMED_FUNNEL)).toBe(true)
  })
})

describe('fetchLiveBlockers', () => {
  it('keeps only applications whose phase_key is not hired/rejected, and only open matches', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/candidates/c1') {
        return Promise.resolve({ data: { data: {
          applications: [
            // Test fixture: mocked API-returned hex data, not a UI colour.
            // eslint-disable-next-line no-restricted-syntax
            { id: 'a1', vacancyTitle: 'Verpleegkundige', stageLabel: 'Voorgesteld', stageColor: '#DDA071' },
            // eslint-disable-next-line no-restricted-syntax
            { id: 'a2', vacancyTitle: 'Oud', stageLabel: 'Aangenomen', stageColor: '#16A34A' },
          ],
          matches: [
            { id: 'm1', vacancy: { title: 'Orderpicker' }, status: 'open' },
            { id: 'm2', vacancy: { title: 'Chauffeur' }, status: 'closed' },
          ],
        } } })
      }
      if (url === '/applications/a1') return Promise.resolve({ data: { data: { phase_key: 'proposal' } } })
      if (url === '/applications/a2') return Promise.resolve({ data: { data: { phase_key: 'hired' } } })
      return Promise.reject(new Error('unexpected url ' + url))
    })

    const result = await fetchLiveBlockers('c1')
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    expect(result.applications).toEqual([{ id: 'a1', vacancyTitle: 'Verpleegkundige', stageLabel: 'Voorgesteld', stageColor: '#DDA071' }])
    expect(result.matches).toEqual([{ id: 'm1', vacancyTitle: 'Orderpicker', client: '', statusKey: 'open' }])
  })

  it('returns no blockers when the candidate has none', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { applications: [], matches: [] } } })
    const result = await fetchLiveBlockers('c2')
    expect(result).toEqual({ applications: [], matches: [] })
  })

  it('does not block on an application whose detail fetch fails', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/candidates/c3') return Promise.resolve({ data: { data: {
        applications: [{ id: 'a1', vacancyTitle: 'X', stageLabel: 'Y', stageColor: null }], matches: [],
      } } })
      return Promise.reject({ response: { status: 404 } })
    })
    const result = await fetchLiveBlockers('c3')
    expect(result.applications).toEqual([])
  })
})

describe('normalizeLivePayload / liveFromError', () => {
  it('normalizes the forward-compat { live } shape, falling back across field names', () => {
    const result = normalizeLivePayload({
      applications: [
        // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
        { id: 'a1', vacancy_title: 'Planner', phase_label: 'Voorgesteld', phase_color: '#DDA071' },
      ],
      matches: [{ id: 'm1', vacancyTitle: 'Orderpicker', customer: { name: 'ACME' }, status: 'open' }],
    })
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    expect(result.applications).toEqual([{ id: 'a1', vacancyTitle: 'Planner', stageLabel: 'Voorgesteld', stageColor: '#DDA071' }])
    expect(result.matches).toEqual([{ id: 'm1', vacancyTitle: 'Orderpicker', client: 'ACME', statusKey: 'open' }])
  })

  it('liveFromError reads the payload off a 409 and ignores everything else', () => {
    const err409 = { response: { status: 409, data: { live: { applications: [{ id: 'a1' }], matches: [] } } } }
    expect(liveFromError(err409)?.applications).toHaveLength(1)

    const err409Empty = { response: { status: 409, data: { live: { applications: [], matches: [] } } } }
    expect(liveFromError(err409Empty)).toBeNull()

    const err422 = { response: { status: 422, data: { live: { applications: [{ id: 'a1' }] } } } }
    expect(liveFromError(err422)).toBeNull()

    expect(liveFromError(new Error('network'))).toBeNull()
  })
})

describe('resolveApplication / resolveMatch', () => {
  it('resolveApplication PATCHes the rejected phase and reports success', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    const ok = await resolveApplication('a1')
    expect(ok).toBe(true)
    expect(api.patch).toHaveBeenCalledWith('/applications/a1', { phase_key: 'rejected' })
  })

  it('resolveApplication reports failure without throwing', async () => {
    vi.mocked(api.patch).mockRejectedValue(new Error('500'))
    await expect(resolveApplication('a1')).resolves.toBe(false)
  })

  // A1 root-cause: with a renamed funnel, resolveApplication must PATCH the FLAGGED
  // is_rejected stage's slug ('afgewezen'), never the hardcoded 'rejected' literal.
  it('resolveApplication resolves the is_rejected-flagged stage from the passed lookup', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
    const ok = await resolveApplication('a1', RENAMED_FUNNEL)
    expect(ok).toBe(true)
    expect(api.patch).toHaveBeenCalledWith('/applications/a1', { phase_key: 'afgewezen' })
  })

  it('resolveMatch DELETEs and reports success', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: {} })
    const result = await resolveMatch('m1')
    expect(result).toEqual({ ok: true, conflict: false })
    expect(api.delete).toHaveBeenCalledWith('/matches/m1')
  })

  it('resolveMatch flags a 409 as a conflict (active HelloFlex contract)', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 409 } })
    const result = await resolveMatch('m1')
    expect(result).toEqual({ ok: false, conflict: true })
  })

  it('resolveMatch treats a non-409 failure as a plain (non-conflict) failure', async () => {
    vi.mocked(api.delete).mockRejectedValue({ response: { status: 500 } })
    const result = await resolveMatch('m1')
    expect(result).toEqual({ ok: false, conflict: false })
  })
})
