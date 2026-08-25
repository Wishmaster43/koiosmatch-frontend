/**
 * whatsappSendChannel.test — CMBE K-193 fase 0 + fase 2b (C) pins for
 * whatsapp_send's `channel` field and its two channel-gated siblings
 * (phone_number_id for waba/waba_coex, whatsapp_number_id for wa_web).
 */
import { describe, it, expect } from 'vitest'
import { MODULE_SCHEMAS } from '@/modules/index'
import whatsappSend from './whatsapp_send'

describe('whatsapp_send · channel field (fase 0)', () => {
  const schema = MODULE_SCHEMAS.whatsapp_send ?? []

  it('is positioned between message_type and phone_number_id', () => {
    const keys = schema.map(f => f.key)
    const iType  = keys.indexOf('message_type')
    const iChan  = keys.indexOf('channel')
    const iPhone = keys.indexOf('phone_number_id')
    expect(iType).toBeGreaterThan(-1)
    expect(iChan).toBe(iType + 1)
    expect(iPhone).toBeGreaterThan(iChan)
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

describe('whatsapp_send · wa_web channel branch (fase 2b)', () => {
  it('whatsapp_number_id sits directly after channel', () => {
    const keys = whatsappSend.schema.map(f => f.key)
    const channelIdx = keys.indexOf('channel')
    expect(keys[channelIdx + 1]).toBe('whatsapp_number_id')
  })

  it('whatsapp_number_id is a required lookup_select on /whatsapp-web-numbers, shown only for wa_web', () => {
    const field = whatsappSend.schema.find(f => f.key === 'whatsapp_number_id')
    expect(field?.type).toBe('lookup_select')
    expect(field?.endpoint).toBe('/whatsapp-web-numbers')
    expect(field?.required).toBe(true)
    expect(field?.showIf).toEqual({ key: 'channel', value: 'wa_web' })
  })

  it('phone_number_id is hidden for wa_web (showIf waba/waba_coex/undefined-legacy)', () => {
    const field = whatsappSend.schema.find(f => f.key === 'phone_number_id')
    expect(field?.showIf).toEqual({ key: 'channel', value: ['waba', 'waba_coex', undefined] })
  })

  it('message_type carries the wa_web-session-only help text', () => {
    const field = whatsappSend.schema.find(f => f.key === 'message_type')
    expect(field?.help).toBe('Via WhatsApp Web kan alleen een sessiebericht (vrije tekst) worden verstuurd.')
  })
})
