import { describe, it, expect } from 'vitest'
import MODULES, { START_MODULE_TYPES, MODULE_SCHEMAS, MODULE_META } from './index'
import { HELLOFLEX_OUTBOUND_CONTACT_COLUMNS } from './_helloflexFields'

// The four HelloFlex action modules of BE HF-WORKFLOWS-1 (W4, W10, §7): registered under the helloflex category,
// never a start node, and their config mirrors the BE configSchema() of each module.
const TYPES = ['helloflex_links_check', 'helloflex_contract_send', 'helloflex_contact_update', 'helloflex_link_employer']

describe('HelloFlex workflow modules (HF-WORKFLOWS-1)', () => {
  it.each(TYPES)('%s is registered under helloflex and is not a start node', (type) => {
    expect(MODULES.some(m => m.type === type)).toBe(true)
    expect(MODULE_META[type].category).toBe('helloflex')
    expect(START_MODULE_TYPES.has(type)).toBe(false)
  })

  it('links check, contract send and employer link carry no config', () => {
    expect(MODULE_SCHEMAS.helloflex_links_check).toEqual([])
    expect(MODULE_SCHEMAS.helloflex_contract_send).toEqual([])
    expect(MODULE_SCHEMAS.helloflex_link_employer).toEqual([])
  })

  it('contact update: a fields multiselect over the seven outbound contact columns, no FE default', () => {
    const schema = MODULE_SCHEMAS.helloflex_contact_update as Array<Record<string, unknown>>
    expect(schema.map(f => f.key)).toEqual(['fields'])
    expect(schema[0]).toMatchObject({ type: 'multiselect' })
    expect(schema[0].default).toBeUndefined()
    expect(schema[0].options).toEqual([...HELLOFLEX_OUTBOUND_CONTACT_COLUMNS])
    expect(HELLOFLEX_OUTBOUND_CONTACT_COLUMNS).toEqual(['last_name', 'first_name', 'middle_name', 'function', 'email', 'mobile', 'phone'])
  })
})
