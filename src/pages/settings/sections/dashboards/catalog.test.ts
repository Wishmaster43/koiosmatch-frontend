/**
 * dashboards/catalog — unit tests for the pure grouping/search helpers behind
 * the F6 rebuild: block-id categorisation, per-role block lists, and the
 * search/on-off predicates the list components share.
 */
import { describe, it, expect } from 'vitest'
import { blockCategory, blocksForRole, groupBlocksByCategory, matchesSearch, matchesOnOff } from './catalog'

describe('blockCategory', () => {
  it('categorises chart./list. ids by their prefix', () => {
    expect(blockCategory('chart.status')).toBe('chart')
    expect(blockCategory('list.candidates')).toBe('list')
  })

  it('falls back to "block" for block. ids and anything without a known prefix', () => {
    expect(blockCategory('block.tasksDueToday')).toBe('block')
    expect(blockCategory('unknown.thing')).toBe('block')
  })
})

describe('blocksForRole', () => {
  it('expands the "*" wildcard template to every known block id', () => {
    const ids = blocksForRole('admin')
    expect(ids.length).toBeGreaterThan(1)
    expect(ids).toContain('chart.status')
    expect(ids).toContain('list.candidates')
  })

  it('returns a role\'s own explicit template list untouched', () => {
    const ids = blocksForRole('sales')
    expect(ids).toEqual(['chart.oppStage', 'chart.status', 'list.leads'])
  })

  // DASHBOARD-MGMT-1 blocker fix: a block hidden by the template default must
  // not appear as a toggleable row at all — visibleBlock() force-hides it
  // regardless of the tenant toggle, so listing it here would be a lying
  // affordance (§3 no fake affordances).
  it('drops the default-hidden blocks from management and recruitment_manager', () => {
    expect(blocksForRole('management')).not.toContain('block.waWebQueue')
    expect(blocksForRole('management')).not.toContain('list.runs')
    expect(blocksForRole('recruitment_manager')).not.toContain('block.waWebQueue')
    expect(blocksForRole('recruitment_manager')).not.toContain('list.runs')
  })

  it('keeps admin (same wildcard, not named in the exclusion) unaffected', () => {
    expect(blocksForRole('admin')).toContain('block.waWebQueue')
    expect(blocksForRole('admin')).toContain('list.runs')
  })
})

describe('groupBlocksByCategory', () => {
  it('buckets ids into chart/list/block groups, omitting empty categories', () => {
    const groups = groupBlocksByCategory(['chart.status', 'list.leads', 'block.shifts'])
    expect(groups.chart).toEqual(['chart.status'])
    expect(groups.list).toEqual(['list.leads'])
    expect(groups.block).toEqual(['block.shifts'])
  })

  it('omits a category entirely when no id belongs to it', () => {
    const groups = groupBlocksByCategory(['chart.status'])
    expect(groups.list).toBeUndefined()
    expect(groups.block).toBeUndefined()
  })
})

describe('matchesSearch', () => {
  it('is case-insensitive and trims the query', () => {
    expect(matchesSearch('Fill rate', '  fill  '.trim())).toBe(true)
    expect(matchesSearch('Fill rate', 'FILL')).toBe(true)
    expect(matchesSearch('Fill rate', 'placements')).toBe(false)
  })

  it('an empty query matches everything', () => {
    expect(matchesSearch('Anything', '')).toBe(true)
    expect(matchesSearch('Anything', '   ')).toBe(true)
  })
})

describe('matchesOnOff', () => {
  it('"all" always matches regardless of state', () => {
    expect(matchesOnOff(true, 'all')).toBe(true)
    expect(matchesOnOff(false, 'all')).toBe(true)
  })

  it('"on"/"off" only match their own state', () => {
    expect(matchesOnOff(true, 'on')).toBe(true)
    expect(matchesOnOff(false, 'on')).toBe(false)
    expect(matchesOnOff(false, 'off')).toBe(true)
    expect(matchesOnOff(true, 'off')).toBe(false)
  })
})
