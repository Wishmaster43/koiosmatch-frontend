import { describe, it, expect } from 'vitest'
import { flattenSample } from './useWorkflowEditor'

// flattenSample turns a test-run sample into the dot-path fields the variable
// picker offers. These lock in the depth cap + array/null handling.
describe('flattenSample', () => {
  it('flattens a flat object to top-level paths with string samples', () => {
    expect(flattenSample({ id: 13, name: 'Mark' })).toEqual([
      { path: 'id', sample: '13' },
      { path: 'name', sample: 'Mark' },
    ])
  })

  it('flattens one nested level into a dot-path', () => {
    expect(flattenSample({ employee: { city: 'Gouda' } })).toEqual([
      { path: 'employee.city', sample: 'Gouda' },
    ])
  })

  it('represents an array by the shape of its first element', () => {
    expect(flattenSample([{ id: 1, name: 'A' }]).map(f => f.path)).toEqual(['id', 'name'])
  })

  it('shows an array-valued field as its length', () => {
    expect(flattenSample({ tags: [1, 2, 3] })).toContainEqual({ path: 'tags', sample: '[3]' })
  })

  it('renders a null value as an empty sample', () => {
    expect(flattenSample({ x: null })).toEqual([{ path: 'x', sample: '' }])
  })

  it('returns nothing for a bare primitive, nullish input or empty array', () => {
    expect(flattenSample(5)).toEqual([])
    expect(flattenSample(null)).toEqual([])
    expect(flattenSample(undefined)).toEqual([])
    expect(flattenSample([])).toEqual([])
  })

  it('caps depth so deeper nesting collapses to a stringified leaf', () => {
    expect(flattenSample({ a: { b: { c: 1 } } })).toEqual([
      { path: 'a.b', sample: '[object Object]' },
    ])
  })
})
