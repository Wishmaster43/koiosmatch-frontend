/**
 * OPS_TILES registry — asserts every entry's hasData is false on an
 * absent/empty feed and true when the feed carries data.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { OPS_TILES } from './index'
import type { DashData } from '@/types/dashboard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/datetime', () => ({ useDateFormat: () => ({ formatDate: (v: string) => v, formatDateTime: (v: string) => v }) }))

describe('OPS_TILES registry', () => {
  it('registers all six ops tiles', () => {
    expect(OPS_TILES.map(e => e.feedKey)).toEqual([
      'matches_by_contract_type',
      'placements_started_ended_today',
      'fill_rate_by_branch',
      'documents_attention',
      'coupling_errors_list',
      'placements_started_today',
    ])
  })

  it('each entry hasData is false on absent/empty and true on data', () => {
    const emptyDash = {} as DashData
    const fixtures: Record<string, unknown> = {
      matches_by_contract_type: [{ value: 'zzp', label: 'ZZP', color: null, count: 1 }],
      placements_started_ended_today: { started: [{ match_id: 'm1', candidate: 'A', customer: null }], ended: [] },
      fill_rate_by_branch: [{ branch_id: 'b1', branch: 'X', total: 1, filled: 1, rate: 100 }],
      documents_attention: [{ candidate_id: 'c1', name: 'A', issue: 'missing_cv', expires_at: null, days_left: null }],
      coupling_errors_list: [{ entity_type: 'candidate', entity_id: 'c1', entity_label: 'A', system: 'shiftmanager', error: null, synced_at: null }],
      placements_started_today: [{ match_id: 'm1', candidate: 'A', customer: null, contract_ok: true, document_ok: true, koppeling_ok: true }],
    }
    const emptyFixtures: Record<string, unknown> = {
      matches_by_contract_type: [],
      placements_started_ended_today: { started: [], ended: [] },
      fill_rate_by_branch: [],
      documents_attention: [],
      coupling_errors_list: [],
      placements_started_today: [],
    }
    for (const entry of OPS_TILES) {
      expect(entry.hasData(emptyDash)).toBe(false)
      expect(entry.hasData({ ...emptyDash, [entry.feedKey]: emptyFixtures[entry.feedKey] } as DashData)).toBe(false)
      expect(entry.hasData({ ...emptyDash, [entry.feedKey]: fixtures[entry.feedKey] } as DashData)).toBe(true)
    }
  })

  it('matches_by_contract_type hasData is false when every row is zero-count', () => {
    const entry = OPS_TILES.find(e => e.feedKey === 'matches_by_contract_type')!
    const dash = { matches_by_contract_type: [{ value: 'zzp', label: 'ZZP', color: null, count: 0 }] } as unknown as DashData
    expect(entry.hasData(dash)).toBe(false)
  })

  it('fill_rate_by_branch hasData is false when every row has a null rate', () => {
    const entry = OPS_TILES.find(e => e.feedKey === 'fill_rate_by_branch')!
    const dash = { fill_rate_by_branch: [{ branch_id: 'b1', branch: 'X', total: 0, filled: 0, rate: null }] } as unknown as DashData
    expect(entry.hasData(dash)).toBe(false)
  })

  it('documents_attention render is wired to the actual data (title renders, a mis-wired render fails)', () => {
    const entry = OPS_TILES.find(e => e.feedKey === 'documents_attention')!
    const dash = { documents_attention: [{ candidate_id: 'c1', name: 'A', issue: 'missing_cv', expires_at: null, days_left: null }] } as unknown as DashData
    const { getByText } = render(<>{entry.render(dash, { hasPlanning: true })}</>)
    expect(getByText('block.documentsAttention')).toBeInTheDocument()
  })

  it('placements_started_ended_today render is wired to the actual data (title renders, a mis-wired render fails)', () => {
    const entry = OPS_TILES.find(e => e.feedKey === 'placements_started_ended_today')!
    const dash = { placements_started_ended_today: { started: [{ match_id: 'm1', candidate: 'A', customer: null }], ended: [] } } as unknown as DashData
    const { getByText } = render(<>{entry.render(dash, { hasPlanning: true })}</>)
    expect(getByText('block.placementsStartedEndedToday')).toBeInTheDocument()
  })
})
