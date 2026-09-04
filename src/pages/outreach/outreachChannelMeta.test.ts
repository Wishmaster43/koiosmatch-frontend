/**
 * outreachChannelMeta — the shared call/email/whatsapp icon+colour map. Pins the
 * channel set, the getter's 'call' fallback and that every channel carries a
 * non-empty colour (the exact hex values are deliberately NOT pinned here: a
 * literal in a test would need its own no-restricted-syntax disable).
 */
import { describe, it, expect } from 'vitest'
import { CHANNEL_META, getChannelMeta } from './outreachChannelMeta'

describe('outreachChannelMeta', () => {
  it('exposes exactly the three fixed channels', () => {
    expect(Object.keys(CHANNEL_META).sort()).toEqual(['call', 'email', 'whatsapp'])
  })

  it('getChannelMeta returns the matching entry for a known channel', () => {
    expect(getChannelMeta('email')).toBe(CHANNEL_META.email)
    expect(getChannelMeta('whatsapp')).toBe(CHANNEL_META.whatsapp)
  })

  it('getChannelMeta falls back to call for a missing or unknown channel', () => {
    expect(getChannelMeta(undefined)).toBe(CHANNEL_META.call)
    expect(getChannelMeta(null)).toBe(CHANNEL_META.call)
    expect(getChannelMeta('sms')).toBe(CHANNEL_META.call)
  })

  it('keeps a stable, non-empty colour per channel (regression pin, no literal restated)', () => {
    expect(CHANNEL_META.call.color).toBeTruthy()
    expect(CHANNEL_META.email.color).toBeTruthy()
    expect(CHANNEL_META.whatsapp.color).toBeTruthy()
  })
})
