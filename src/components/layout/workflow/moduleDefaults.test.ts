/**
 * defaultConfigFor (DEFAULT-PERSIST-1) — a synthetic MODULE_SCHEMAS fixture keeps
 * this decoupled from the real registry: a defaulted field is seeded, a bare field
 * is skipped, and a showIf-hidden field with a default is seeded ANYWAY (the engine
 * reads raw config, not panel visibility). An unknown type seeds nothing.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/modules/index', () => ({
  MODULE_SCHEMAS: {
    fixture: [
      { key: 'with_default', type: 'text', default: 'foo' },
      { key: 'zero_default', type: 'number', default: 0 },
      { key: 'false_default', type: 'boolean', default: false },
      { key: 'no_default', type: 'text' },
      // Hidden behind a showIf — must still seed, since the engine never
      // consults the panel's current tab/field visibility.
      { key: 'hidden_with_default', type: 'select', default: 'x', showIf: { key: 'with_default', value: 'foo' } },
    ],
    empty_schema: [],
  },
}))

const { defaultConfigFor } = await import('./moduleDefaults')

describe('defaultConfigFor', () => {
  it('seeds only the fields that declare a default, including falsy ones (0, false)', () => {
    expect(defaultConfigFor('fixture')).toEqual({
      with_default: 'foo',
      zero_default: 0,
      false_default: false,
      hidden_with_default: 'x',
    })
  })

  it('seeds a showIf-hidden field anyway (engine reads config, not visibility)', () => {
    expect(defaultConfigFor('fixture')).toHaveProperty('hidden_with_default', 'x')
  })

  it('returns {} for a type with an empty schema', () => {
    expect(defaultConfigFor('empty_schema')).toEqual({})
  })

  it('returns {} for an unregistered type (never throws)', () => {
    expect(defaultConfigFor('does_not_exist')).toEqual({})
  })
})
