import { describe, it, expect } from 'vitest'
import { isLucideSlug, lazyFor } from './lazyLucide'

describe('lazyLucide', () => {
  it('knows real slugs and aliases, rejects unknown and prototype keys', () => {
    expect(isLucideSlug('mail')).toBe(true)
    expect(isLucideSlug('bar-chart-3')).toBe(true)
    expect(isLucideSlug('no-such-icon-xyz')).toBe(false)
    expect(isLucideSlug('constructor')).toBe(false)
  })

  it('returns the same lazy component for the same slug', () => {
    expect(lazyFor('mail')).toBe(lazyFor('mail'))
    expect(lazyFor('mail')).not.toBe(lazyFor('phone'))
  })
})
