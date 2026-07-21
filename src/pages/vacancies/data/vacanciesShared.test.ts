/**
 * resolveStatusSegment · V27 (VACATURES-100) — the status donut used to fold ANY
 * unresolved (but real, non-null) status id into the "Geen status" bucket, because
 * the fallback chain ended on the no-status copy no matter why the label was
 * missing. That mislabelled real, just-unresolved statuses as "no status" and
 * inflated that segment's count. This guards the fixed preference order: tenant
 * lookup → loaded row → the backend's own resolved label → a distinct "unknown"
 * copy — "Geen status" is reserved for a literal null value.
 */
import { describe, it, expect } from 'vitest'
import { resolveStatusSegment, buildVacancyPatch } from './vacanciesShared'

const statusMeta = (v: string) => (v === 's1' ? { label: 'Open', color: '#79B58E' } : {})
const NO_STATUS = 'Geen status'
const UNKNOWN = 'Onbekend'

describe('resolveStatusSegment', () => {
  it('a literal null status is the real "no status" bucket', () => {
    const seg = resolveStatusSegment({ value: null, count: 5 }, statusMeta, new Map(), NO_STATUS, UNKNOWN)
    expect(seg).toMatchObject({ name: NO_STATUS, value: 5, key: '__none' })
  })

  it('resolves via the live tenant lookup when it knows the status id', () => {
    const seg = resolveStatusSegment({ value: 's1', count: 3 }, statusMeta, new Map(), NO_STATUS, UNKNOWN)
    expect(seg).toMatchObject({ name: 'Open', color: '#79B58E', value: 3, key: 's1' })
  })

  it('falls back to a loaded row carrying the same status id when the current lookup misses it (VAC-SEED-1: two status sets)', () => {
    const rowMeta = new Map([['s2', { label: 'Gepauzeerd', color: '#C9AC64' }]])
    const seg = resolveStatusSegment({ value: 's2', count: 2 }, statusMeta, rowMeta, NO_STATUS, UNKNOWN)
    expect(seg).toMatchObject({ name: 'Gepauzeerd', color: '#C9AC64', key: 's2' })
  })

  it('falls back to the backend-resolved label before ever assuming "no status"', () => {
    const seg = resolveStatusSegment({ value: 's3', count: 1, label: 'Concept', color: '#94A3B8' }, statusMeta, new Map(), NO_STATUS, UNKNOWN)
    expect(seg.name).toBe('Concept')
  })

  it('THE V27 BUG: a real status id unresolved everywhere is "Onbekend", never silently "Geen status"', () => {
    const seg = resolveStatusSegment({ value: 's-orphaned', count: 7 }, statusMeta, new Map(), NO_STATUS, UNKNOWN)
    expect(seg.name).toBe(UNKNOWN)
    expect(seg.name).not.toBe(NO_STATUS)
    expect(seg.key).toBe('s-orphaned')
    expect(seg.value).toBe(7)
  })

  it('never leaks the raw uuid as the display name', () => {
    const seg = resolveStatusSegment({ value: '3f2b1c4d-0000-0000-0000-000000000000', count: 1 }, statusMeta, new Map(), NO_STATUS, UNKNOWN)
    expect(seg.name).toBe(UNKNOWN)
  })
})

// VAC-DATES-1: the runtime-window rows persist through the same generic UI-patch →
// API-body mapping the rest of DetailsTab uses (buildVacancyPatch), reused verbatim
// by the application drawer's VacancyTab (S20) — so this one mapping backs both.
describe('buildVacancyPatch · runtime window (VAC-DATES-1)', () => {
  it('maps startDate/endDate to the API snake_case fields', () => {
    const body = buildVacancyPatch({ startDate: '2026-01-01', endDate: '2026-06-30' })
    expect(body).toEqual({ start_date: '2026-01-01', end_date: '2026-06-30' })
  })

  it('omits start_date/end_date entirely when absent from the patch (partial saves)', () => {
    const body = buildVacancyPatch({ title: 'New title' })
    expect(body).toEqual({ title: 'New title' })
    expect(body).not.toHaveProperty('start_date')
    expect(body).not.toHaveProperty('end_date')
  })
})

// VAC-AGENT-1: linking an agent IS the interview on/off switch for this vacancy
// (Option A) — the patch carries only the agent id, never a separate flow field.
describe('buildVacancyPatch · AI agent link (VAC-AGENT-1)', () => {
  it('maps aiAgentId to ai_agent_id when linking an agent', () => {
    const body = buildVacancyPatch({ aiAgentId: 'agent1' })
    expect(body).toEqual({ ai_agent_id: 'agent1' })
  })

  it('maps aiAgentId: null to ai_agent_id: null when unlinking', () => {
    const body = buildVacancyPatch({ aiAgentId: null })
    expect(body).toEqual({ ai_agent_id: null })
  })

  it('omits ai_agent_id entirely when absent from the patch (partial saves)', () => {
    const body = buildVacancyPatch({ title: 'New title' })
    expect(body).not.toHaveProperty('ai_agent_id')
  })

  it('never sends the display-only aiAgentName field to the API', () => {
    const body = buildVacancyPatch({ aiAgentId: 'agent1', aiAgentName: 'Intake bot' })
    expect(body).toEqual({ ai_agent_id: 'agent1' })
  })
})
