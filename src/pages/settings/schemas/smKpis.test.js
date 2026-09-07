/**
 * smKpis — Shiftmanager dashboard KPI targets (lane J cleanup, X-7).
 * Asserts that dead keys (sm_open_shifts_warning, sm_no_show_threshold) are removed.
 */
import { describe, it, expect } from 'vitest'
import smKpis from './smKpis'

describe('smKpis · dead keys removed', () => {
  it('carries only the three active KPI keys', () => {
    const keys = smKpis.fields.map((f) => f.key)
    expect(keys).toEqual(['sm_occupancy_target', 'sm_fill_rate_target', 'sm_filled_shifts_target'])
  })

  it('sm_open_shifts_warning is absent', () => {
    const keys = smKpis.fields.map((f) => f.key)
    expect(keys).not.toContain('sm_open_shifts_warning')
  })

  it('sm_no_show_threshold is absent', () => {
    const keys = smKpis.fields.map((f) => f.key)
    expect(keys).not.toContain('sm_no_show_threshold')
  })
})
