import { describe, it, expect } from 'vitest'
import helloflexInbound from './helloflex_inbound'
import MODULES, { START_MODULE_TYPES, MODULE_REQUIRED_MODULE, MODULE_APP_MAP } from './index'
import { HELLOFLEX_FILTER_NAMES } from '@/components/layout/workflow/eventCatalog'

// The HelloFlex start node: registered, a vertrekmodule, gated on the HelloFlex connector (module hf and app hf), an events multi-select over the HelloFlex filter names plus two booleans.
describe('helloflex_inbound module', () => {
  it('is registered, a valid start module and gated on the HelloFlex connector (module hf and app hf)', () => {
    expect(MODULES.some(m => m.type === 'helloflex_inbound')).toBe(true)
    expect(START_MODULE_TYPES.has('helloflex_inbound')).toBe(true)
    expect(MODULE_REQUIRED_MODULE.helloflex_inbound).toBe('hf')
    expect(MODULE_APP_MAP.helloflex_inbound).toBe('hf')
    expect(helloflexInbound.category).toBe('triggers')
  })

  it('has a required events multi-select over the 18 HelloFlex filter names plus the two booleans', () => {
    expect(helloflexInbound.schema).toHaveLength(3)
    const [events, fetchEntity, onlyLinked] = helloflexInbound.schema as Array<Record<string, unknown>>
    expect(events).toMatchObject({ key: 'events', type: 'multiselect', required: true })
    expect((events.options as Array<{ value: string }>).map(o => o.value)).toEqual(HELLOFLEX_FILTER_NAMES)
    expect(HELLOFLEX_FILTER_NAMES).toHaveLength(18)
    expect(fetchEntity).toMatchObject({ key: 'fetch_entity', type: 'boolean', default: false })
    expect(onlyLinked).toMatchObject({ key: 'only_linked', type: 'boolean', default: false })
  })
})
