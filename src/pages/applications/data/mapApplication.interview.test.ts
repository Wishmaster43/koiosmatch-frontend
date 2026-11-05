/** mapApplication · match summary, interview payload and skip block (split from mapApplication.test.ts; pure mapper tests). */
import { describe, it, expect } from 'vitest'
import { mapApplicationDetail, mapInterview, mapMatchSummary, readInterviewSkip } from './mapApplication'

// PLACEMENT-REMOVED-1 (verified live 2026-08-07, CMBE 5961c673): the deprecated
// `placement_*` alias (MATCH-VOCABULAIRE-1) is REMOVED from the Match block —
// ApplicationDetailResource::matchLink() only ever sends `match_start`/`match_end`
// now. The mapper's fallback read is pruned; this pins that a stray `placement_*`
// (e.g. an old cached payload) is never surfaced as if it were a real date.
describe('mapMatchSummary · match_start/match_end (PLACEMENT-REMOVED-1)', () => {
  it('maps the match_start/match_end pair', () => {
    const summary = mapMatchSummary({ id: 'm1', match_start: '2026-08-01', match_end: '2026-09-01' } as never)
    expect(summary).toMatchObject({ matchStart: '2026-08-01', matchEnd: '2026-09-01' })
  })

  it('ignores a stray deprecated placement_start/placement_end pair — it is no longer read', () => {
    const summary = mapMatchSummary({ id: 'm2', placement_start: '2026-08-01', placement_end: '2026-09-01' } as never)
    expect(summary).toMatchObject({ matchStart: null, matchEnd: null })
  })

  it('leaves both null when neither pair is present', () => {
    const summary = mapMatchSummary({ id: 'm3' } as never)
    expect(summary).toMatchObject({ matchStart: null, matchEnd: null })
  })
})

// Regression (30-07): the backend derives `turn` with a MIXED vocabulary — 'agent' and
// 'recruiter' in English next to 'kandidaat' and 'afgerond' in Dutch — while the chip looks
// up its label and colour by that value. The two Dutch ones rendered a raw i18n key with no
// colour. And `paused_by` arrives as a bare uuid with the name in `paused_by_name`, which
// the mapper read as an object, so "overgenomen door …" was permanently empty.
describe('mapInterview · the backend contract as it really is', () => {
  it("maps the Dutch turn values onto our own vocabulary", () => {
    expect(mapInterview({ turn: 'kandidaat' } as never)?.turn).toBe('candidate')
    expect(mapInterview({ turn: 'afgerond' } as never)?.turn).toBe('completed')
  })

  it('passes the English ones through untouched', () => {
    expect(mapInterview({ turn: 'agent' } as never)?.turn).toBe('agent')
    expect(mapInterview({ turn: 'recruiter' } as never)?.turn).toBe('recruiter')
  })

  it('reads paused_by as a bare uuid plus its separate display name', () => {
    const iv = mapInterview({ paused_by: 'u-1', paused_by_name: 'Kelly Yesway' } as never)
    expect(iv?.pausedBy).toEqual({ id: 'u-1', name: 'Kelly Yesway' })
  })

  it('still accepts a nested paused_by, in case the resource ever nests it', () => {
    const iv = mapInterview({ paused_by: { id: 'u-2', name: 'Tom Demo' } } as never)
    expect(iv?.pausedBy).toEqual({ id: 'u-2', name: 'Tom Demo' })
  })

  it('leaves pausedBy null when nobody took over', () => {
    expect(mapInterview({ turn: 'agent' } as never)?.pausedBy).toBeNull()
  })
})

// The exact body InterviewSessionResource::block() emits (measured 01-08), mapped in
// one go. It guards the two seams that were silently dead: `flow_name` (added by the
// backend — the drawer subtitle had nothing to render before) and the timing pair,
// which the mapper read under column names that do not exist.
describe('mapInterview · the real InterviewSessionResource payload', () => {
  const resourceBody = {
    id: 'sess-1',
    flow_id: 'flow-1',
    flow_name: 'Verpleegkundige intake',
    current_status: 'ACTIVE_IN_CARE',
    statuses: ['START', 'ACTIVE_IN_CARE', 'DONE'],
    step: 2,
    total: 3,
    collected: {},
    started_at: '2026-07-28T09:00:00Z',
    completed_at: '2026-08-01T11:30:00Z',
    last_sent_at: '2026-08-01T11:25:00Z',
    duration_seconds: 354600,
    turn: 'afgerond',
    disqualified_reason: null,
    paused_at: null,
    paused_by: null,
    paused_by_name: null,
    agent: { id: 'agent-1', name: 'Yesway Zorg-agent' },
  }

  it('maps every field of the resource body, including the flow name the card subtitles with', () => {
    expect(mapInterview(resourceBody as never)).toEqual({
      category: 'completed',
      currentStatus: 'ACTIVE_IN_CARE',
      step: 2,
      total: 3,
      id: 'sess-1',
      agent: { id: 'agent-1', name: 'Yesway Zorg-agent' },
      flowName: 'Verpleegkundige intake',
      flowId: 'flow-1',
      turn: 'completed',
      startedAt: '2026-07-28T09:00:00Z',
      lastMessageAt: '2026-08-01T11:25:00Z',
      endedAt: '2026-08-01T11:30:00Z',
      durationSeconds: 354600,
        questionStepIndex: null, questionStepsTotal: 0, sessionScope: 'application',
      pausedAt: null,
      pausedBy: null,
      waitingSince: null,
    })
  })

  // The list resource sends a strict subset: no agent, turn, started_at,
  // duration_seconds or pause metadata. Those must map to null, so no list surface
  // can accidentally present an empty value as a real one.
  it('maps the LIST subset without inventing the detail-only fields', () => {
    const listRow = {
      id: 'sess-1', category: 'busy', current_status: 'ACTIVE_IN_CARE', step: 2, total: 3,
      flow_name: 'Verpleegkundige intake', completed_at: null, last_sent_at: '2026-08-01T11:25:00Z',
    }
    expect(mapInterview(listRow as never)).toMatchObject({
      category: 'busy', flowName: 'Verpleegkundige intake', lastMessageAt: '2026-08-01T11:25:00Z',
      agent: null, turn: null, startedAt: null, durationSeconds: null, endedAt: null,
      pausedAt: null, pausedBy: null,
    })
  })
})

describe('interview skip block (INTERVIEW-SKIP-ON-APPLICATION-1)', () => {
  const skipped = { status: 'skipped', skip_reason: 'send_failed', skipped_at: '2026-10-21T09:30:00Z' }

  it('readInterviewSkip reads reason and time from a skipped block only', () => {
    expect(readInterviewSkip(skipped)).toEqual({ reason: 'send_failed', at: '2026-10-21T09:30:00Z' })
    expect(readInterviewSkip({ category: 'busy' })).toEqual({ reason: null, at: null })
    expect(readInterviewSkip(null)).toEqual({ reason: null, at: null })
  })

  it('mapInterview returns null for a skipped block and still maps a session', () => {
    expect(mapInterview(skipped)).toBeNull()
    expect(mapInterview({ category: 'completed' })?.category).toBe('completed')
  })

  it('mapApplicationDetail carries reason and time and shows no session', () => {
    const m = mapApplicationDetail({ id: 9, interview: skipped })
    expect(m.interview).toBeNull()
    expect(m.interviewSkipReason).toBe('send_failed')
    expect(m.interviewSkippedAt).toBe('2026-10-21T09:30:00Z')
  })
})
