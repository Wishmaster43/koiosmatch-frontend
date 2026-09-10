import { describe, it, expect } from 'vitest'
import { Circle, Building2, SlidersHorizontal, BarChart3 } from 'lucide-react'
import { lucideByName } from './lucideByName'

describe('lucideByName', () => {
  it('resolves kebab-case contract names, including digits, and falls back on unknown or empty', () => {
    // lucide's `icons` map and its named exports are separate component objects with the
    // same displayName, so the identity check runs on the name.
    expect(lucideByName('building-2', Circle).displayName).toBe(Building2.displayName)
    expect(lucideByName('sliders-horizontal', Circle).displayName).toBe(SlidersHorizontal.displayName)
    expect(lucideByName('bar-chart-3', Circle).displayName).toBe(BarChart3.displayName)
    expect(lucideByName('no-such-icon-xyz', Circle)).toBe(Circle)
    expect(lucideByName(null, Circle)).toBe(Circle)
  })
})
