import { describe, it, expect } from 'vitest'
import MODULES, { START_MODULE_TYPES, MODULE_SCHEMAS, MODULE_META } from './index'
import { HELLOFLEX_OUTBOUND_CANDIDATE_COLUMNS } from './_helloflexFields'

// The five HelloFlex write steps of BE HF-ENTITY-SYNC-1a: registered under the helloflex category, never a
// start node, and their config fields mirror the BE configSchema() of each module.
const TYPES = ['helloflex_ensure_candidate', 'helloflex_ensure_contact', 'helloflex_activity_create', 'helloflex_candidate_update', 'helloflex_candidate_deactivate']

describe('HelloFlex write modules', () => {
  it.each(TYPES)('%s is registered under helloflex and is not a start node', (type) => {
    expect(MODULES.some(m => m.type === type)).toBe(true)
    expect(MODULE_META[type].category).toBe('helloflex')
    expect(START_MODULE_TYPES.has(type)).toBe(false)
  })

  it('ensure candidate: a source text field and adopt_by_email defaulting to true', () => {
    const schema = MODULE_SCHEMAS.helloflex_ensure_candidate as Array<Record<string, unknown>>
    expect(schema.map(f => f.key)).toEqual(['source', 'adopt_by_email'])
    expect(schema[0]).toMatchObject({ type: 'text' })
    expect(schema[1]).toMatchObject({ type: 'boolean', default: true })
  })

  it('ensure contact: the source field only', () => {
    const schema = MODULE_SCHEMAS.helloflex_ensure_contact as Array<Record<string, unknown>>
    expect(schema.map(f => f.key)).toEqual(['source'])
  })

  it('activity create and candidate deactivate carry no config', () => {
    expect(MODULE_SCHEMAS.helloflex_activity_create).toEqual([])
    expect(MODULE_SCHEMAS.helloflex_candidate_deactivate).toEqual([])
  })

  it('candidate update: a fields multiselect over the twelve outbound candidate columns', () => {
    const schema = MODULE_SCHEMAS.helloflex_candidate_update as Array<Record<string, unknown>>
    expect(schema.map(f => f.key)).toEqual(['fields'])
    expect(schema[0]).toMatchObject({ type: 'multiselect' })
    expect(schema[0].options).toEqual([...HELLOFLEX_OUTBOUND_CANDIDATE_COLUMNS])
    expect(HELLOFLEX_OUTBOUND_CANDIDATE_COLUMNS).toHaveLength(12)
  })
})
