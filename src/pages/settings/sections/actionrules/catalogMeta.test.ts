/**
 * catalogMeta tests — a drift guard against `app/Services/ActionRules/ActionRuleCatalog.php`
 * (koiosmatch-api, read-only from this repo): a handful of cells transcribed from the PHP
 * source, checked against the local mirror. A mismatch here means catalogMeta.ts is out of
 * sync with the backend catalog and the override badge / locked cells would be wrong.
 */
import { describe, it, expect } from 'vitest'
import { defaultEffectFor, popupCodeFor, isLockedCell } from './catalogMeta'

describe('catalogMeta defaults (mirrors ActionRuleCatalog::defaults())', () => {
  it('application.create × blacklist is a hard block (P3)', () => {
    expect(defaultEffectFor('application.create', 'blacklist')).toBe('block')
    expect(popupCodeFor('application.create', 'blacklist')).toBe('P3')
  })

  it('task.create × blacklist is only a warn (P7) — administrative override in the seed itself', () => {
    expect(defaultEffectFor('task.create', 'blacklist')).toBe('warn')
    expect(popupCodeFor('task.create', 'blacklist')).toBe('P7')
  })

  it('match.create × lead is a warn (P5) — still a Lead, not yet a Candidate', () => {
    expect(defaultEffectFor('match.create', 'lead')).toBe('warn')
    expect(popupCodeFor('match.create', 'lead')).toBe('P5')
  })

  it('every candidate action × archived defaults to a hard block (P4)', () => {
    expect(defaultEffectFor('candidate.status_set', 'archived')).toBe('block')
    expect(popupCodeFor('candidate.status_set', 'archived')).toBe('P4')
    expect(defaultEffectFor('candidate.sync', 'archived')).toBe('block')
  })

  it('the AVG no-consent gate on whatsapp.send is a hard block (P8)', () => {
    expect(defaultEffectFor('whatsapp.send', 'whatsapp.no_consent')).toBe('block')
    expect(popupCodeFor('whatsapp.send', 'whatsapp.no_consent')).toBe('P8')
  })

  it('customer.match × active is a silent allow with no popup', () => {
    expect(defaultEffectFor('customer.match', 'active')).toBe('allow')
    expect(popupCodeFor('customer.match', 'active')).toBeNull()
  })

  it('an unknown cell safely falls back to allow (mirrors defaultEffect() own fallback)', () => {
    expect(defaultEffectFor('not.a.real.action', 'not_a_condition')).toBe('allow')
  })
})

describe('isLockedCell (frontend-only safeguard for system-wide hard rules)', () => {
  it('locks every archived cell on the candidate axis', () => {
    expect(isLockedCell('application.create', 'archived')).toBe(true)
    expect(isLockedCell('task.create', 'archived')).toBe(true)
  })

  it('locks the WhatsApp no-consent gate', () => {
    expect(isLockedCell('whatsapp.send', 'whatsapp.no_consent')).toBe(true)
  })

  it('leaves blacklist (P3) and customer-blocked (P10) tenant-editable, not locked', () => {
    expect(isLockedCell('application.create', 'blacklist')).toBe(false)
    expect(isLockedCell('opportunity.create', 'blocked')).toBe(false)
  })
})
