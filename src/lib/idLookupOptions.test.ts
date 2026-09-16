/**
 * idLookupOptions — the shared id-keyed lookup mapper (§13, pure function test).
 */
import { describe, it, expect } from 'vitest'
import { mapIdLabelOptions } from './idLookupOptions'

describe('mapIdLabelOptions', () => {
  it('maps id → value, preferring label over name/value', () => {
    const res = { data: { data: [{ id: '1', label: 'A' }, { id: '2', name: 'B' }, { id: '3', value: 'C' }] } } as never
    expect(mapIdLabelOptions(res)).toEqual([{ value: '1', label: 'A' }, { value: '2', label: 'B' }, { value: '3', label: 'C' }])
  })

  it('returns null for an empty or unusable response', () => {
    expect(mapIdLabelOptions({ data: { data: [] } } as never)).toBeNull()
    expect(mapIdLabelOptions({ data: {} } as never)).toBeNull()
  })
})
