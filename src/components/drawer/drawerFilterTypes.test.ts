/**
 * buildTaskFilterRows — the status/type/priority multi-select rows every
 * tasks-table filter panel builds from its own tenant lookups: status is
 * always present, type/priority only appear once their lookup has options (an
 * empty tenant lookup means that dimension does not exist there yet), and
 * every row carries its search/no-results copy from the caller's own t().
 */
import { describe, it, expect, vi } from 'vitest'
import { buildTaskFilterRows } from './drawerFilterTypes'

const t = (key: string) => key
const noop = vi.fn()
const baseArgs = {
  t, statusFilter: [] as string[], typeFilter: [] as string[], priorityFilter: [] as string[],
  toggleStatus: noop, toggleType: noop, togglePriority: noop,
}

describe('buildTaskFilterRows', () => {
  it('always includes the status row, even with no type/priority lookups', () => {
    const rows = buildTaskFilterRows({ ...baseArgs, statuses: [{ value: 'open', label: 'Open' }], types: [], priorities: [] })
    expect(rows.map(r => r.key)).toEqual(['status'])
  })

  it('omits the type row when the types lookup is empty', () => {
    const rows = buildTaskFilterRows({
      ...baseArgs, statuses: [{ value: 'open', label: 'Open' }], types: [], priorities: [{ value: 'high', label: 'High' }],
    })
    expect(rows.some(r => r.key === 'type')).toBe(false)
    expect(rows.some(r => r.key === 'priority')).toBe(true)
  })

  it('omits the priority row when the priorities lookup is empty', () => {
    const rows = buildTaskFilterRows({
      ...baseArgs, statuses: [{ value: 'open', label: 'Open' }], types: [{ value: 'call', label: 'Call' }], priorities: [],
    })
    expect(rows.some(r => r.key === 'priority')).toBe(false)
    expect(rows.some(r => r.key === 'type')).toBe(true)
  })

  it('includes all three rows, in order, when every lookup has options', () => {
    const rows = buildTaskFilterRows({
      ...baseArgs,
      statuses: [{ value: 'open', label: 'Open' }],
      types: [{ value: 'call', label: 'Call' }],
      priorities: [{ value: 'high', label: 'High' }],
    })
    expect(rows.map(r => r.key)).toEqual(['status', 'type', 'priority'])
  })

  it('carries searchPlaceholder/noResultsLabel from t on every row', () => {
    const rows = buildTaskFilterRows({
      ...baseArgs,
      statuses: [{ value: 'open', label: 'Open' }],
      types: [{ value: 'call', label: 'Call' }],
      priorities: [{ value: 'high', label: 'High' }],
    })
    for (const row of rows) {
      expect(row).toMatchObject({ searchPlaceholder: 'common:search', noResultsLabel: 'common:noResults' })
    }
  })
})
