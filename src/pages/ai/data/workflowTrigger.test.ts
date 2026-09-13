import { describe, it, expect } from 'vitest'
import { triggerKeyForType } from './workflowTrigger'

describe('triggerKeyForType', () => {
  it('maps each known trigger type to its i18n key', () => {
    expect(triggerKeyForType('scheduled')).toBe('list.triggerScheduled')
    expect(triggerKeyForType('webhook')).toBe('list.triggerWebhook')
    expect(triggerKeyForType('event')).toBe('list.triggerEvent')
  })

  it('falls back to manual for unknown or missing types', () => {
    expect(triggerKeyForType(undefined)).toBe('list.triggerManual')
    expect(triggerKeyForType('something-else')).toBe('list.triggerManual')
  })
})
