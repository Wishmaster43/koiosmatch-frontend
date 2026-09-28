import { describe, it, expect } from 'vitest'
import { shapePreviewRows } from './pendingPreview'

// A t() stand-in mirroring how react-i18next resolves an unmatched key:
// return the defaultValue when there is one for this key, otherwise the raw key.
const t = (key: string, opts?: { defaultValue?: string }) => {
  const translations: Record<string, string> = {
    'koios.pendingAction.fields.title': 'Title',
    'koios.pendingAction.confidence.high': 'high',
  }
  return translations[key] ?? opts?.defaultValue ?? key
}

describe('shapePreviewRows', () => {
  it('translates a legacy Dutch key and its English twin to the same label', () => {
    const { rows: legacy } = shapePreviewRows([{ label: 'titel', text: 'Belafspraak' }], t)
    const { rows: english } = shapePreviewRows([{ label: 'title', text: 'Belafspraak' }], t)
    expect(legacy[0].label).toBe('Title')
    expect(english[0].label).toBe('Title')
  })

  it('falls back to a humanised label for an unknown key', () => {
    const { rows } = shapePreviewRows([{ label: 'employer_name', text: 'Acme' }], t)
    expect(rows[0].label).toBe('Employer name')
  })

  it('hides both the legacy and the English id key', () => {
    const { rows } = shapePreviewRows([
      { label: 'kandidaat_id', text: '67742906-cb41-43d0-9a59-320c80da0923' },
      { label: 'candidate_id', text: '67742906-cb41-43d0-9a59-320c80da0923' },
    ], t)
    expect(rows).toHaveLength(0)
  })

  it('hides any row whose value is a UUID, regardless of its key', () => {
    const { rows } = shapePreviewRows([{ label: 'kandidaat', text: '67742906-cb41-43d0-9a59-320c80da0923' }], t)
    expect(rows).toHaveLength(0)
  })

  it('extracts the legacy confidence key as confidence, translated, and drops it from rows', () => {
    const { rows, confidence } = shapePreviewRows([{ label: 'zekerheid', text: 'hoog' }], t)
    expect(rows).toHaveLength(0)
    expect(confidence).toBe('high')
  })

  it('humanises an ISO date inside a preview value', () => {
    const { rows } = shapePreviewRows([{ label: 'deadline', text: '2026-09-29' }], t)
    expect(rows[0].text).toBe('29-09-2026')
  })

  it('humanises ISO dates in before/after too', () => {
    const { rows } = shapePreviewRows([{ label: 'date', before: '2026-01-01', after: '2026-09-29' }], t)
    expect(rows[0].before).toBe('01-01-2026')
    expect(rows[0].after).toBe('29-09-2026')
  })

  it('preserves row order once id/confidence rows are removed', () => {
    const { rows } = shapePreviewRows([
      { label: 'kandidaat_id', text: 'x' },
      { label: 'titel', text: 'A' },
      { label: 'zekerheid', text: 'laag' },
      { label: 'omschrijving', text: 'B' },
    ], t)
    expect(rows.map((r) => r.text)).toEqual(['A', 'B'])
  })
})
