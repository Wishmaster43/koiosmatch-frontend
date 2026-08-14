import { describe, it, expect } from 'vitest'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

const CATALOG = ['a', 'b', 'c', 'd', 'e']
const DEFAULT = ['a', 'b', 'c', 'd', 'e']

describe('resolveReportKpiOrder', () => {
  it('returns the default order when nothing is stored', () => {
    const { order, fellBack } = resolveReportKpiOrder(undefined, CATALOG, DEFAULT)
    expect(order).toEqual(DEFAULT)
    expect(fellBack).toBe(false)
  })

  it('returns the stored order unchanged when every key still exists', () => {
    const stored = ['c', 'a', 'e', 'b', 'd']
    const { order, fellBack } = resolveReportKpiOrder(stored, CATALOG, DEFAULT)
    expect(order).toEqual(stored)
    expect(fellBack).toBe(false)
  })

  it('falls back a single vanished key to the default, keeping length and never crashing', () => {
    const stored = ['c', 'a', 'ghost', 'b', 'd']
    const { order, fellBack } = resolveReportKpiOrder(stored, CATALOG, DEFAULT)
    expect(order).toHaveLength(DEFAULT.length)
    expect(order).not.toContain('ghost')
    expect(order).toContain('e')
    expect(fellBack).toBe(true)
  })

  it('dedupes a stored key repeated twice and backfills from the default', () => {
    const stored = ['a', 'a', 'b', 'c', 'd']
    const { order, fellBack } = resolveReportKpiOrder(stored, CATALOG, DEFAULT)
    expect(order).toHaveLength(DEFAULT.length)
    expect(new Set(order).size).toBe(order.length)
    expect(order).toContain('e')
    expect(fellBack).toBe(true)
  })

  it('never returns fewer entries than the default order', () => {
    const { order } = resolveReportKpiOrder(['ghost1', 'ghost2'], CATALOG, DEFAULT)
    expect(order).toHaveLength(DEFAULT.length)
  })
})
