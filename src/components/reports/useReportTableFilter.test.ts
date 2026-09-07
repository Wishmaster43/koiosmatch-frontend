/**
 * useReportTableFilter — test consolidation of filter/search/sort logic for report tables.
 * Tests: compareSortable sorts correctly and handles null/undefined values.
 */
import { describe, it, expect } from 'vitest'
import { compareSortable } from './useReportTableFilter'

describe('useReportTableFilter', () => {
  describe('compareSortable', () => {
    it('sorts strings ascending by default', () => {
      const items = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }]
      items.sort((a, b) => compareSortable(a, b, 'name', 'asc'))
      expect(items.map(i => i.name)).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('sorts strings descending when dir is desc', () => {
      const items = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }]
      items.sort((a, b) => compareSortable(a, b, 'name', 'desc'))
      expect(items.map(i => i.name)).toEqual(['Charlie', 'Bob', 'Alice'])
    })

    it('handles null and undefined values as empty strings', () => {
      const items = [
        { value: 'Zebra' },
        { value: null },
        { value: undefined },
        { value: 'Apple' },
      ] as Array<{ value: string | null | undefined }>
      items.sort((a, b) => compareSortable(a, b, 'value', 'asc'))
      const result = items.map(i => i.value)
      // Empty strings (null/undefined) come first in ascending order
      expect(result[0]).toBeNull()
      expect(result[1]).toBeUndefined()
      expect(result[2]).toBe('Apple')
      expect(result[3]).toBe('Zebra')
    })

    it('performs case-insensitive comparison', () => {
      const items = [{ label: 'zebra' }, { label: 'ALICE' }, { label: 'Bob' }]
      items.sort((a, b) => compareSortable(a, b, 'label', 'asc'))
      expect(items.map(i => i.label)).toEqual(['ALICE', 'Bob', 'zebra'])
    })

    it('returns 0 when values are equal', () => {
      const a = { name: 'Test' }
      const b = { name: 'test' }
      const result = compareSortable(a, b, 'name', 'asc')
      expect(result).toBe(0)
    })
  })
})
