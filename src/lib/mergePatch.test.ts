/**
 * mergePatch tests — regression coverage for ZZP-MERGE-1 (the candidate ZZP tab's
 * Facturatie save wiping Bedrijf/Adres from the local view). The `freelance`
 * fixture shape below mirrors what PATCH /candidates/{id} actually returns
 * (measured live 2026-08-09 against tenant `yesway`, candidate Koen Blom).
 */
import { describe, it, expect } from 'vitest'
import { mergePatch } from './mergePatch'

// The real freelance/ZZP block shape (GET /candidates/{id}), trimmed to the keys
// relevant here — Bedrijf + Adres + Facturatie all live on this one nested object.
const zzpRecord = {
  id: 'c1',
  zzp: {
    company_name: 'Koen Blom ZZP',
    kvk_number: '80982183',
    vat_number: null,
    kor: false,
    street: 'Voorbeeldstraat',
    house_number: '83',
    postal_code: '1953 HK',
    creditor_number: 'CR-001',
    business_email: null,
    iban: null,
    account_holder_name: null,
  },
}

describe('mergePatch', () => {
  // THE BUG: saving only the Facturatie block must leave Bedrijf/Adres keys intact.
  it('deep-merges a patch touching only part of a nested object, keeping sibling keys', () => {
    const patch = { zzp: { creditor_number: 'CR-002', business_email: 'zzp@example.test', iban: 'NL91ABNA0417164300' } }
    const result = mergePatch(zzpRecord, patch)
    // The Facturatie fields update…
    expect(result.zzp.creditor_number).toBe('CR-002')
    expect(result.zzp.business_email).toBe('zzp@example.test')
    expect(result.zzp.iban).toBe('NL91ABNA0417164300')
    // …but Bedrijf/Adres keys (untouched by this patch) survive — this is the bug:
    // a shallow `{ ...record, ...patch }` would have replaced the whole zzp object
    // and dropped every one of these.
    expect(result.zzp.company_name).toBe('Koen Blom ZZP')
    expect(result.zzp.kvk_number).toBe('80982183')
    expect(result.zzp.street).toBe('Voorbeeldstraat')
    expect(result.zzp.house_number).toBe('83')
    expect(result.zzp.postal_code).toBe('1953 HK')
    // The original record is never mutated in place.
    expect(zzpRecord.zzp.creditor_number).toBe('CR-001')
  })

  // EDGE CASE 1: arrays must still replace wholesale, never merge element-by-element.
  it('replaces an array patch value wholesale instead of merging it', () => {
    const record = { id: 'c1', tags: ['a', 'b', 'c'] }
    const result = mergePatch(record, { tags: ['a', 'b'] })
    expect(result.tags).toEqual(['a', 'b'])
  })

  // EDGE CASE 2: an explicit null must clear the field, never be swallowed.
  it('applies an explicit null as a clear, not a no-op', () => {
    const record = { id: 'c1', zzp: { ...zzpRecord.zzp, vat_number: '80982183' } }
    const result = mergePatch(record, { zzp: { vat_number: null } })
    expect(result.zzp.vat_number).toBeNull()
    // Sibling keys still survive alongside the clear.
    expect(result.zzp.company_name).toBe('Koen Blom ZZP')
  })

  // A top-level explicit null (not nested) also clears, not merges/skips.
  it('applies a top-level explicit null as a clear', () => {
    const record = { id: 'c1', ownerId: 'u1' }
    const result = mergePatch(record, { ownerId: null })
    expect(result.ownerId).toBeNull()
  })

  // A flat scalar patch (no nested object involved) behaves exactly like the old
  // shallow spread — no regression for the common case.
  it('overwrites a plain scalar field like a shallow merge would', () => {
    const record = { id: 'c1', name: 'Old' }
    const result = mergePatch(record, { name: 'New' })
    expect(result.name).toBe('New')
  })

  // A nested object patch against a base where the existing value ISN'T an
  // object yet (e.g. still undefined) just adopts the patch as-is — nothing to
  // merge into.
  it('adopts a nested object patch as-is when the base has no existing object there', () => {
    const record = { id: 'c1' } as { id: string; zzp?: Record<string, unknown> }
    const result = mergePatch(record, { zzp: { company_name: 'New Co' } })
    expect(result.zzp).toEqual({ company_name: 'New Co' })
  })
})
