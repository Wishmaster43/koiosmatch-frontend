import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { activityLabel } from './activityLabel'

// Echo t that carries the namespace it was given, so a wrong-namespace lookup would show.
const t = ((k: string, o?: { ns?: string }) => `${o?.ns ?? ''}:${k}`) as unknown as TFunction

describe('activityLabel', () => {
  // A known code resolves through the settings activity-map key, asked of the checker in that namespace.
  it('translates a known code through the settings namespace', () => {
    const i18n = { exists: (k: string, o?: { ns?: string }) => k === 'billing.usage.activity.activityMap.chat' && o?.ns === 'settings' }
    expect(activityLabel(t, i18n, 'chat')).toBe('settings:billing.usage.activity.activityMap.chat')
  })
  // An unknown code renders raw.
  it('returns the raw code when unknown', () => {
    expect(activityLabel(t, { exists: () => false }, 'future_code')).toBe('future_code')
  })
  // An empty checker object (a test tree without an i18n instance) renders raw.
  it('returns the raw code for an empty i18n object', () => {
    expect(activityLabel(t, {} as unknown as { exists: () => boolean }, 'chat')).toBe('chat')
  })
})
