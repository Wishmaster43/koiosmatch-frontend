import { describe, it, expect } from 'vitest'
import whatsappInbound from './whatsapp_inbound'
import { START_MODULE_TYPES } from './index'

// The number binding lives on the webhook-agent trigger, never on this node.
describe('whatsapp_inbound schema', () => {
  it('labels the source field Source and carries no number field', () => {
    const f = whatsappInbound.schema.find(s => s.key === 'source') as Record<string, unknown>
    expect(f.label).toBe('Source')
    expect(whatsappInbound.schema.some(s => s.key === 'number_id')).toBe(false)
  })
  it('stays a registered start module', () => {
    expect(START_MODULE_TYPES.has('whatsapp_inbound')).toBe(true)
  })
})

// The source option labels carry no Dutch and resolve to fieldOptions keys in the active language.
describe('whatsapp_inbound source option labels', () => {
  const field = whatsappInbound.schema.find(s => s.key === 'source') as Record<string, unknown>
  const options = field.options as Array<{ value: string; label: string }>

  it('uses English source labels', () => {
    expect(options.map(o => o.label)).toEqual(['Meta webhook (WABA + Coexistence)', 'WhatsApp Web (own number)'])
  })
})
