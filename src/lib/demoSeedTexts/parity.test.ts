/**
 * demoSeedTexts parity — drift guard (DEMO-SEED-TAAL-1). The four language
 * catalogues must share EXACTLY the same key set, and every key must be the
 * normalized form of a text that actually exists in the harvested inventory
 * (e2e/demo-text-inventory.json). A re-harvest that changes the seeded prose
 * must fail this test loudly, not silently leave a stale/orphan translation.
 */
import { describe, it, expect } from 'vitest'
import de from './de'
import fr from './fr'
import es from './es'
import en from './en'

// Mirrors the normalize() in ./index.ts exactly — outer trim + inner whitespace collapse.
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

// Loads the harvest JSON via Vite's import.meta.glob (no node fs) so tsc and
// vitest agree — mirrors i18n/localeParity.test.ts's own convention.
const inventoryModules = import.meta.glob('../../../e2e/demo-text-inventory.json', { eager: true, import: 'default' }) as Record<string, { text: string }[]>
const inventory = Object.values(inventoryModules)[0] ?? []
const inventoryKeys = new Set(inventory.map(x => normalize(x.text)))

describe('demoSeedTexts catalogue parity', () => {
  it('every catalogue has the same key set as every other', () => {
    const deKeys = Object.keys(de).sort()
    const frKeys = Object.keys(fr).sort()
    const esKeys = Object.keys(es).sort()
    const enKeys = Object.keys(en).sort()
    expect(frKeys).toEqual(deKeys)
    expect(esKeys).toEqual(deKeys)
    expect(enKeys).toEqual(deKeys)
  })

  it('every catalogue key is a normalized text present in the harvested inventory', () => {
    const missing = Object.keys(de).filter(key => !inventoryKeys.has(key))
    expect(missing).toEqual([])
  })

  it('every harvested text is covered by the catalogues (no un-translated seed)', () => {
    const uncovered = [...inventoryKeys].filter(key => !(key in de))
    expect(uncovered).toEqual([])
  })
})
