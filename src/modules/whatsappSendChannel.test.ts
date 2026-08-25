/**
 * whatsappSendChannel.test — CMBE K-193 fase 0: whatsapp_send's `channel` field
 * sits between message_type and phone_number_id, is required, carries the three
 * contract enum values, and — deliberately — has NO default (Danny: no silent
 * fallback to 'waba' in the builder).
 */
import { describe, it, expect } from 'vitest'
import { MODULE_SCHEMAS } from '@/modules/index'

describe('whatsapp_send · channel field', () => {
  const schema = MODULE_SCHEMAS.whatsapp_send ?? []

  it('is positioned between message_type and phone_number_id', () => {
    const keys = schema.map(f => f.key)
    const iType  = keys.indexOf('message_type')
    const iChan  = keys.indexOf('channel')
    const iPhone = keys.indexOf('phone_number_id')
    expect(iType).toBeGreaterThan(-1)
    expect(iChan).toBe(iType + 1)
    expect(iPhone).toBe(iChan + 1)
  })

  it('carries the three CMBE K-193 channel enum values, required, no silent default', () => {
    const field = schema.find(f => f.key === 'channel') as (typeof schema)[number] & { required?: boolean }
    expect(field?.options).toEqual(['waba', 'waba_coex', 'wa_web'])
    expect(field?.required).toBe(true)
    expect(field?.default).toBeUndefined()
  })

  it('phone_number_id switches to the channel-filtering picker type', () => {
    const field = schema.find(f => f.key === 'phone_number_id')
    expect(field?.type).toBe('whatsapp_phone_number')
    expect(field?.endpoint).toBe('/whatsapp-phone-numbers')
  })
})
