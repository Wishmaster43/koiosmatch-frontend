/**
 * translateInterviewStatus — the engine-set markers resolve through the shared
 * applications:interview.currentStatus.<raw> key family when it exists; every other
 * flow-authored status value renders as the humanized raw value, never the raw enum.
 */
import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { humanizeInterviewStatus, translateInterviewStatus } from './interviewStatus'

// Key-echo t that carries the namespace it was given, so a wrong-namespace lookup would show.
const t = ((key: string, o?: { ns?: string }) => `${o?.ns ?? ''}:${key}`) as unknown as TFunction

describe('translateInterviewStatus', () => {
  it('resolves an engine marker through the applications namespace when the key exists', () => {
    const i18n = { exists: (_key: string, o?: { ns?: string }) => o?.ns === 'applications' }
    expect(translateInterviewStatus(t, i18n, 'COMPLETED')).toBe('applications:interview.currentStatus.COMPLETED')
  })

  it('humanizes a flow-authored status when no key exists', () => {
    const i18n = { exists: () => false }
    expect(translateInterviewStatus(t, i18n, 'ACTIVE_IN_CARE')).toBe(humanizeInterviewStatus('ACTIVE_IN_CARE'))
    expect(translateInterviewStatus(t, i18n, 'ACTIVE_IN_CARE')).not.toContain('ACTIVE_IN_CARE')
  })
})
