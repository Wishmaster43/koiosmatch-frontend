/**
 * match_application_lookup.test — the registry carries a card for the engine's
 * match-based application lookup (three seeded scenarios use it; without the card
 * the canvas rendered "Onbekende module", Danny 14-09 08:50). Shape only: the BE
 * catalogue serves schema [] for it, so the card must not invent config fields.
 */
import { describe, it, expect } from 'vitest'
import MODULES, { MODULE_META, MODULE_SCHEMAS } from './index'
import card from './match_application_lookup'

describe('match_application_lookup module card', () => {
  it('is registered under the engine type with an empty config schema, like application_lookup', () => {
    expect(MODULES.find(m => m.type === 'match_application_lookup')).toBe(card)
    expect(MODULE_SCHEMAS.match_application_lookup).toEqual([])
    expect(MODULE_META.match_application_lookup).toMatchObject({ category: 'Sollicitaties' })
  })
})
