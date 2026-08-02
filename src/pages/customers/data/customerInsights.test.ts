/**
 * customerInsights — Danny 02-08: "bij de status-donut tonen we prospect als
 * status — kijk af bij kandidaat". Covers the two pure helpers behind the status
 * donut's '__none' (no-status/entry-phase) bucket: the click router and the
 * bucket builder (stats path + page-derived fallback).
 */
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling (whole file) */
import { describe, it, expect } from 'vitest'
import { NO_STATUS_KEY, pickCustomerStatusSegment, buildCustomerStatusOptions } from './customerInsights'

describe('pickCustomerStatusSegment · the no-status segment filters the PHASE, not the status', () => {
  it('routes the __none segment to the PHASE axis, with the entry phase as its value', () => {
    expect(pickCustomerStatusSegment(NO_STATUS_KEY, 'prospect')).toEqual({ axis: 'phase', value: 'prospect' })
  })

  it('routes every other segment to the STATUS axis, unchanged', () => {
    expect(pickCustomerStatusSegment('active', 'prospect')).toEqual({ axis: 'status', value: 'active' })
  })
})

describe('buildCustomerStatusOptions · stats path (server-wide totals)', () => {
  const entryPhase = { label: 'Prospect', color: '#1B60A9' }
  const statuses = [{ value: 'active', label: 'Actief', color: '#16A34A' }]

  it('turns an empty-value stats bucket into the __none bucket, labelled from the entry phase', () => {
    const opts = buildCustomerStatusOptions({
      statsByStatus: [{ value: '', count: 3 }, { value: 'active', count: 5 }],
      customers: [], statuses, entryPhase, entryPhaseValue: 'prospect', noStatusFallbackLabel: 'No status',
    })
    expect(opts).toEqual([
      { value: NO_STATUS_KEY, label: 'Prospect', color: '#1B60A9', count: 3 },
      { value: 'active', label: 'Actief', color: '#16A34A', count: 5 },
    ])
  })
})

describe('buildCustomerStatusOptions · page-derived fallback (no stats)', () => {
  const entryPhase = { label: 'Prospect', color: '#1B60A9' }
  const statuses = [{ value: 'active', label: 'Actief', color: '#16A34A' }, { value: 'inactive', label: 'Inactief', color: '#D97706' }]

  it('buckets an entry-phase customer as __none EVEN when it still carries a literal status value', () => {
    const customers = [
      // Still carries the retiring 'prospect'-ish status value, but its PHASE is
      // the entry phase — the rule must key on phase, not on this value.
      { status: 'active', phase: 'prospect' },
      { status: 'active', phase: 'klant' },
      { status: 'inactive', phase: 'klant' },
    ]
    const opts = buildCustomerStatusOptions({
      customers, statuses, entryPhase, entryPhaseValue: 'prospect', noStatusFallbackLabel: 'No status',
    })
    expect(opts).toEqual([
      { value: NO_STATUS_KEY, label: 'Prospect', color: '#1B60A9', count: 1 },
      { value: 'active', label: 'Actief', color: '#16A34A', count: 1 },
      { value: 'inactive', label: 'Inactief', color: '#D97706', count: 1 },
    ])
  })

  it('never special-cases a literal status value named "prospect" — only the phase decides the bucket', () => {
    // A customer past the entry phase whose status happens to be the string
    // 'prospect' (stale data) must NOT land in __none — only phase does that.
    const customers = [{ status: 'prospect', phase: 'klant' }]
    const staleStatuses = [...statuses, { value: 'prospect', label: 'Prospect (stale)', color: '#1B60A9' }]
    const opts = buildCustomerStatusOptions({
      customers, statuses: staleStatuses, entryPhase, entryPhaseValue: 'prospect', noStatusFallbackLabel: 'No status',
    })
    expect(opts).toEqual([{ value: 'prospect', label: 'Prospect (stale)', color: '#1B60A9', count: 1 }])
  })
})
