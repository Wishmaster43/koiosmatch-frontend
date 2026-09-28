// koiosToolIds — KOIOS-EN-1 phase B alias map (SHARED-UNIT-TEST-1: a new shared
// unit ships with its own behaviour test).
import { describe, it, expect } from 'vitest'
import { LEGACY_TOOL_IDS, canonicalToolId, pick } from './koiosToolIds'

describe('canonicalToolId', () => {
  it('resolves a legacy (Dutch) tool id to its new English id', () => {
    expect(canonicalToolId('zoek_kandidaten')).toBe('search_candidates')
    expect(canonicalToolId('wijzig_taak')).toBe('update_task')
    expect(canonicalToolId('stuur_whatsapp')).toBe('send_whatsapp')
    expect(canonicalToolId('maak_taak')).toBe('create_task')
  })

  it('returns an already-English id unchanged', () => {
    expect(canonicalToolId('search_candidates')).toBe('search_candidates')
    expect(canonicalToolId('start_interview')).toBe('start_interview')
  })

  it('returns an unknown id unchanged (never throws)', () => {
    expect(canonicalToolId('some_future_tool')).toBe('some_future_tool')
  })

  it('every legacy id maps to a distinct English id present nowhere else as a legacy id', () => {
    const values = Object.values(LEGACY_TOOL_IDS)
    // No English id should itself be a key needing translation (would signal a stale entry).
    values.forEach((v) => expect(LEGACY_TOOL_IDS[v]).toBeUndefined())
  })
})

describe('pick', () => {
  it('reads the English key when both are present', () => {
    expect(pick({ ok: true, gelukt: false }, 'ok', 'gelukt')).toBe(true)
  })

  it('falls back to the Dutch key when only it is present', () => {
    expect(pick({ gelukt: false }, 'ok', 'gelukt')).toBe(false)
  })

  it('reads the English key when only it is present', () => {
    expect(pick({ ok: false }, 'ok', 'gelukt')).toBe(false)
  })

  it('returns undefined when neither key is present', () => {
    expect(pick({ other: 1 }, 'ok', 'gelukt')).toBeUndefined()
  })

  it('returns undefined for a null/undefined object', () => {
    expect(pick(null, 'ok', 'gelukt')).toBeUndefined()
    expect(pick(undefined, 'ok', 'gelukt')).toBeUndefined()
  })
})
