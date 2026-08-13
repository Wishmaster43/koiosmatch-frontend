/**
 * mergeTimelineEvents — B24 merge-ordering coverage: two sources (e.g. notes +
 * status changes) must interleave strictly chronologically, newest-first,
 * mirroring the single-source order EventTimeline itself assumes.
 */
import { describe, it, expect } from 'vitest'
import { mergeTimelineEvents } from './mergeTimelineEvents'

describe('mergeTimelineEvents', () => {
  // Two sources, chronologically INTERLEAVED (not just concatenated): the
  // merged output must read newest-first regardless of which source an event
  // came from.
  it('interleaves two sources into one newest-first chronological list', () => {
    const notes = [
      { id: 'n1', kind: 'note', time: '2026-08-10T09:00:00Z', text: 'Note A' },
      { id: 'n2', kind: 'note', time: '2026-08-12T09:00:00Z', text: 'Note C' },
    ]
    const statusChanges = [
      { id: 's1', kind: 'status', time: '2026-08-11T09:00:00Z', text: 'Status B' },
      { id: 's2', kind: 'status', time: '2026-08-13T09:00:00Z', text: 'Status D' },
    ]
    const merged = mergeTimelineEvents(notes, statusChanges)
    expect(merged.map(e => e.id)).toEqual(['s2', 'n2', 's1', 'n1'])
  })

  it('sorts undated events last, keeping their relative order stable', () => {
    const a = [{ id: 'dated', time: '2026-08-10T09:00:00Z' }]
    const b = [{ id: 'undated-1' }, { id: 'undated-2' }]
    const merged = mergeTimelineEvents(a, b)
    expect(merged.map(e => e.id)).toEqual(['dated', 'undated-1', 'undated-2'])
  })

  it('treats an unparseable time the same as missing (never crashes, never sorts first)', () => {
    const merged = mergeTimelineEvents(
      [{ id: 'bad', time: 'not-a-date' }],
      [{ id: 'good', time: '2026-08-10T09:00:00Z' }],
    )
    expect(merged.map(e => e.id)).toEqual(['good', 'bad'])
  })

  it('returns an empty list for no/empty sources', () => {
    expect(mergeTimelineEvents()).toEqual([])
    expect(mergeTimelineEvents([], [])).toEqual([])
  })
})
