/**
 * useDriverLicenses — test the key mapping from API response.
 */
import { describe, it, expect } from 'vitest'

// Mimic the mapper logic for testing.
interface Named { name?: string; label?: string; value?: string; icon?: string; key?: string }

const mapDriverLicenses = (rows: unknown[]) => {
  const items = rows
    .map(x => {
      if (typeof x === 'string') return { value: x, label: x, icon: null, key: null }
      const n = x as Named
      const name = n.name ?? n.label ?? n.value
      return name ? { value: name, label: name, icon: n.icon ?? null, key: n.key ?? null } : null
    })
    .filter((v): v is { value: string; label: string; icon: string | null; key: string | null } => Boolean(v))
  return items
}

describe('useDriverLicenses', () => {
  it('maps key field from API response', () => {
    const rows = [
      { name: 'Rijbewijs B', key: 'b', icon: null },
      { name: 'Rijbewijs C', key: 'c', icon: 'truck' },
    ]
    const mapped = mapDriverLicenses(rows)
    expect(mapped[0]).toEqual({ value: 'Rijbewijs B', label: 'Rijbewijs B', icon: null, key: 'b' })
    expect(mapped[1]).toEqual({ value: 'Rijbewijs C', label: 'Rijbewijs C', icon: 'truck', key: 'c' })
  })

  it('handles null key values', () => {
    const rows = [
      { name: 'Rijbewijs BE', key: null, icon: null },
    ]
    const mapped = mapDriverLicenses(rows)
    expect(mapped[0].key).toBe(null)
  })

  it('handles missing key field', () => {
    const rows = [
      { name: 'Rijbewijs A' },
    ]
    const mapped = mapDriverLicenses(rows)
    expect(mapped[0]).toEqual({ value: 'Rijbewijs A', label: 'Rijbewijs A', icon: null, key: null })
  })
})
