import { describe, it, expect } from 'vitest'
import { isWorkPermitBlockVisible, resolveNationalityRow, normalizeName } from './workPermitVisibility'
import type { NationalityRow } from './workPermitVisibility'

/**
 * DANNY-PUNT-1 — the work-permit card's visibility rule.
 *
 * The lookup rows below are the REAL ones measured on GET /nationalities (tenant
 * yesway, 09-08), including the two traps that make this rule non-trivial: the
 * lookup says 'Nederlands' while every seeded candidate says 'Nederlandse', and
 * 'Overig' carries no country_code at all.
 */
const ROWS: NationalityRow[] = [
  { name: 'Nederlands', country_code: 'NL', is_eu: true },
  { name: 'Belgisch', country_code: 'BE', is_eu: true },
  { name: 'Duits', country_code: 'DE', is_eu: true },
  { name: 'Marokkaans', country_code: 'MA', is_eu: false },
  { name: 'Brits', country_code: 'GB', is_eu: false },
  { name: 'Oekraïens', country_code: 'UA', is_eu: false },
  { name: 'Overig', country_code: null, is_eu: false },
]

// Shared base: a resolved lookup and an NL company, so each test varies one thing.
const base = { rows: ROWS, lookupResolved: true, companyCountry: 'NL', dataState: 'empty' as const }

describe('workPermitVisibility · the four cases Danny specified', () => {
  it('same country + empty card → HIDDEN (the Dutch candidate at the Dutch company)', () => {
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Nederlandse' })).toBe(false)
  })

  it('different country → VISIBLE', () => {
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Marokkaans' })).toBe(true)
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Duits' })).toBe(true)
  })

  it('filled card → VISIBLE even when the nationality matches the company country', () => {
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Nederlandse', dataState: 'filled' })).toBe(true)
  })

  it('card contents not observable → VISIBLE (a blind spot is never treated as empty)', () => {
    // Today's real production path: mapCandidate drops both work-permit columns, so
    // the drawer cannot see a stored permit. Hiding on that would lose real data.
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Nederlandse', dataState: 'unobservable' })).toBe(true)
  })

  it('unknown nationality → VISIBLE (unknown is not proof of sameness)', () => {
    expect(isWorkPermitBlockVisible({ ...base, nationality: '' })).toBe(true)
    expect(isWorkPermitBlockVisible({ ...base, nationality: null })).toBe(true)
    expect(isWorkPermitBlockVisible({ ...base, nationality: '   ' })).toBe(true)
  })
})

describe('workPermitVisibility · every unproven case keeps the card visible', () => {
  it('stays visible while the nationality lookup has not answered yet', () => {
    expect(isWorkPermitBlockVisible({
      ...base, nationality: 'Nederlandse', rows: [], lookupResolved: false,
    })).toBe(true)
  })

  it('stays visible when the company country is not configured or not loaded', () => {
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Nederlandse', companyCountry: null })).toBe(true)
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Nederlandse', companyCountry: '' })).toBe(true)
  })

  it('stays visible for a nationality that is not in the lookup at all', () => {
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Klingon' })).toBe(true)
  })

  it('stays visible for a lookup row without a country_code (the seeded "Overig")', () => {
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Overig' })).toBe(true)
  })

  it('stays visible when two lookup rows share one name — ambiguous data is never guessed', () => {
    const ambiguous: NationalityRow[] = [
      { name: 'Nederlands', country_code: 'NL', is_eu: true },
      { name: 'Nederlands', country_code: 'BE', is_eu: true },
    ]
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Nederlands', rows: ambiguous })).toBe(true)
  })

  it('stays visible for a same-country nationality the tenant did NOT mark EU/EEA — the backend guard would still block it', () => {
    // A British candidate at a British company: the country matches, but
    // WorkPermitGuard keys on is_eu alone, so hiding the card would strand the
    // recruiter with an unfixable 422 at match creation.
    expect(isWorkPermitBlockVisible({ ...base, nationality: 'Brits', companyCountry: 'GB' })).toBe(true)
  })
})

describe('workPermitVisibility · resolving a Dutch adjective onto a country code', () => {
  it('resolves the inflected form the seeder actually stores (Nederlandse → NL)', () => {
    expect(resolveNationalityRow(ROWS, 'Nederlandse')?.country_code).toBe('NL')
  })

  it('resolves the plain lookup form unchanged', () => {
    expect(resolveNationalityRow(ROWS, 'Nederlands')?.country_code).toBe('NL')
  })

  it('resolves the inflection in the other direction too (lookup inflected, candidate plain)', () => {
    const inflectedLookup: NationalityRow[] = [{ name: 'Belgische', country_code: 'BE', is_eu: true }]
    expect(resolveNationalityRow(inflectedLookup, 'Belgisch')?.country_code).toBe('BE')
  })

  it('ignores case, surrounding whitespace and diacritics', () => {
    expect(resolveNationalityRow(ROWS, '  nederlandse ')?.country_code).toBe('NL')
    expect(resolveNationalityRow(ROWS, 'OEKRAIENS')?.country_code).toBe('UA')
    expect(normalizeName('Oekraïens')).toBe('oekraiens')
  })

  it('prefers an exact match over an inflected one — it never reaches past a real hit', () => {
    const both: NationalityRow[] = [
      { name: 'Duitse', country_code: 'DE', is_eu: true },
      { name: 'Duits', country_code: 'AT', is_eu: true },
    ]
    expect(resolveNationalityRow(both, 'Duitse')?.country_code).toBe('DE')
  })

  it('refuses to resolve when the inflection is ambiguous', () => {
    const colliding: NationalityRow[] = [
      { name: 'Duits', country_code: 'DE', is_eu: true },
      { name: 'Duitse', country_code: 'AT', is_eu: true },
    ]
    expect(resolveNationalityRow(colliding, 'Duitss')).toBeNull()
    expect(resolveNationalityRow(ROWS, '')).toBeNull()
  })

  it('the live vocabulary has no trailing-e collisions, so the fallback is unambiguous there', () => {
    // Guards the assumption the inflection fallback rests on: no two REAL rows
    // differ by exactly one trailing 'e'. If a tenant ever adds such a pair, the
    // resolver returns null (test above) rather than guessing — but this pins
    // that today's seeded vocabulary is clean.
    const names = ROWS.map(r => normalizeName(r.name))
    const collisions = names.filter(a => names.some(b => b !== a && (a === `${b}e` || b === `${a}e`)))
    expect(collisions).toEqual([])
  })
})
