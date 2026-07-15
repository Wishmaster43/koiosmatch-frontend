/**
 * auditShared — regression coverage for the CHANGELOG-3 generalisation: the central
 * audit page must render the same uniform `entry.changes` diff shape as the
 * per-entity changelog popovers (not the old `entry.properties.attributes` shape),
 * and access (read) events must be distinguishable from write events.
 */
import { describe, it, expect } from 'vitest'
import '@/i18n'
import i18n from '@/i18n'
import { isAccessEvent, buildFieldDiff, entityLabel, NOISE_FIELDS } from './auditShared'

// Minimal stand-in for react-i18next's `t` outside a component tree.
const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

describe('isAccessEvent', () => {
  it('is true only for a "viewed" event (the AVG dossier-access log)', () => {
    expect(isAccessEvent({ event: 'viewed' })).toBe(true)
    expect(isAccessEvent({ event: 'updated' })).toBe(false)
    expect(isAccessEvent({ event: 'created' })).toBe(false)
    expect(isAccessEvent({})).toBe(false)
    expect(isAccessEvent(undefined)).toBe(false)
  })
})

describe('buildFieldDiff', () => {
  it('reads the uniform CHANGELOG-3 shape (entry.changes.attributes/old), not entry.properties', () => {
    const entry = {
      event: 'updated',
      changes: { attributes: { status: 'placed', phone: '0612345678' }, old: { status: 'available', phone: '0612345678' } },
      properties: { source: 'web', ip: '127.0.0.1' }, // must NOT be read for the diff
    }
    const rows = buildFieldDiff(entry, t)
    expect(rows).toHaveLength(1) // phone unchanged -> dropped
    expect(rows[0]).toMatchObject({ field: 'status', before: 'available', after: 'placed' })
  })

  it('returns [] when there is no changes bag (e.g. an access/"viewed" entry)', () => {
    expect(buildFieldDiff({ event: 'viewed', properties: { ip: '1.2.3.4' } }, t)).toEqual([])
    expect(buildFieldDiff({}, t)).toEqual([])
  })

  it('drops noise/bookkeeping fields', () => {
    const entry = { event: 'updated', changes: { attributes: { id: 'x', updated_at: 'now', name: 'New' }, old: { id: 'x', updated_at: 'then', name: 'Old' } } }
    const rows = buildFieldDiff(entry, t)
    expect(rows.map(r => r.field)).toEqual(['name'])
    for (const noise of NOISE_FIELDS) expect(rows.some(r => r.field === noise)).toBe(false)
  })

  it('on CREATE, only lists fields that actually got a value (empty -> empty is dropped)', () => {
    const entry = { event: 'created', changes: { attributes: { name: 'Alice', middle_name: '' }, old: {} } }
    const rows = buildFieldDiff(entry, t)
    expect(rows.map(r => r.field)).toEqual(['name'])
  })

  it('renders a nested object value (e.g. a vacancy match_weights json) as JSON, never "[object Object]"', () => {
    const weights = { qualifications: 3, technical_fit: 3, soft_skills: 3, cultural_alignment: 3, career_aspirations: 3, location: 3 }
    const entry = { event: 'updated', changes: { attributes: { match_weights: null }, old: { match_weights: weights } } }
    const rows = buildFieldDiff(entry, t)
    expect(rows).toHaveLength(1)
    expect(rows[0].before).toBe(JSON.stringify(weights))
    expect(rows[0].before).not.toContain('[object Object]')
    expect(rows[0].after).toBe(t('audit.emptyValue', { defaultValue: 'Empty' }))
  })

  it('masks arrive verbatim from the backend (REDACTED / CHANGED markers are not reformatted)', () => {
    const entry = { event: 'updated', changes: { attributes: { bsn: '[gewijzigd]' }, old: { bsn: '[gewijzigd]' } } }
    // Both sides equal -> dropped, mirrors "no Leeg -> Leeg" rule for masked-but-unchanged values.
    expect(buildFieldDiff(entry, t)).toEqual([])
  })
})

describe('entityLabel', () => {
  it('humanises a namespaced Spatie subject_type down to the short entity key', () => {
    expect(entityLabel('App\\Models\\Candidate', t)).toBe(t('audit.entity.candidate'))
    // No audit.entity.customer_location translation exists -> falls back to the raw class name (never blank).
    expect(entityLabel('App\\Models\\CustomerLocation', t)).toBe('CustomerLocation')
  })

  it('returns null without a subject_type', () => {
    expect(entityLabel(null, t)).toBeNull()
    expect(entityLabel(undefined, t)).toBeNull()
  })
})
