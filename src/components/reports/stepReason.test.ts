import { describe, it, expect } from 'vitest'
import type { TFunction } from 'i18next'
import { stepReasonLabel, stepBlockedCodes, STEP_REASON_CODES } from './stepReason'
import nl from '@/i18n/locales/nl/reports.json'
import en from '@/i18n/locales/en/reports.json'
import de from '@/i18n/locales/de/reports.json'
import fr from '@/i18n/locales/fr/reports.json'
import es from '@/i18n/locales/es/reports.json'
import it_ from '@/i18n/locales/it/reports.json'
import pt from '@/i18n/locales/pt/reports.json'

// Minimal t() stub mirroring runReason.test.ts — echoes the key so a known-code call is verifiable.
const mockT = ((key: string) => key) as TFunction

describe('stepReasonLabel', () => {
  it('resolves a known code to its i18n key', () => {
    expect(stepReasonLabel('nothing_created', mockT)).toBe('runs.stepReasons.nothing_created')
    expect(stepReasonLabel('retention_link_unsupported', mockT)).toBe('runs.stepReasons.retention_link_unsupported')
  })

  it('returns null for an unknown code, so the caller keeps the server sentence (never a raw code)', () => {
    expect(stepReasonLabel('some_future_reason', mockT)).toBeNull()
  })

  it('returns null for a missing reason (a step that did its job)', () => {
    expect(stepReasonLabel(null, mockT)).toBeNull()
    expect(stepReasonLabel(undefined, mockT)).toBeNull()
    expect(stepReasonLabel('', mockT)).toBeNull()
  })

  it('has a translated sentence for every code in all seven locales, without an em dash (§5)', () => {
    expect(STEP_REASON_CODES).toHaveLength(20)
    for (const [lc, json] of Object.entries({ nl, en, de, fr, es, it: it_, pt })) {
      const labels = (json as { runs: { stepReasons: Record<string, string> } }).runs.stepReasons
      for (const code of STEP_REASON_CODES) {
        expect(typeof labels[code], `${lc}.${code}`).toBe('string')
        expect(labels[code], `${lc}.${code}`).not.toContain('—')
      }
    }
  })
})

describe('stepBlockedCodes', () => {
  it('reads the refusal codes off the trailing suffix', () => {
    expect(stepBlockedCodes({ reason: 'action_rule_blocked', message: 'Blocked' })).toEqual([])
    expect(stepBlockedCodes({ reason: 'applications_all_blocked', message: 'x (P3)' })).toEqual(['P3'])
    expect(stepBlockedCodes({ reason: 'action_rule_blocked', message: 'x (P3, P5)' })).toEqual(['P3', 'P5'])
    expect(stepBlockedCodes({ reason: 'action_rule_blocked', message: 'plain', error: 'y (P2)' })).toEqual(['P2'])
    expect(stepBlockedCodes({ reason: 'no_phone', message: 'x (P3)' })).toEqual([])
  })
})
