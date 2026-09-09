/**
 * resolveMessage — the welcome bubble speaks to the reader by first name and names
 * the open attention points (Danny 09-09: "Hoi Kelly wat kan ik voor je doen" +
 * "er zijn aandachtspunten voor je"; no feature list).
 */
import { describe, it, expect } from 'vitest'
import { resolveMessage } from './koiosMessageParts'
import type { KoiosChatMessage } from '@/types/koios'

const t = (key: string, opts?: Record<string, unknown>) => opts ? `${key}(${JSON.stringify(opts)})` : key
const welcome = { role: 'assistant', kind: 'welcome' } as KoiosChatMessage

describe('resolveMessage · welcome', () => {
  it('greets by first name and appends the attention line when there are open points', () => {
    expect(resolveMessage(welcome, t, { name: 'Kelly', attentionCount: 3 }).text)
      .toBe('koios.welcome({"name":"Kelly"})\n\nkoios.welcomeAttention({"count":3})')
  })

  it('greets anonymously without a name and stays a single line without attention points', () => {
    expect(resolveMessage(welcome, t, { name: '  ', attentionCount: 0 }).text).toBe('koios.welcomeAnonymous')
    expect(resolveMessage(welcome, t).text).toBe('koios.welcomeAnonymous')
  })
})
