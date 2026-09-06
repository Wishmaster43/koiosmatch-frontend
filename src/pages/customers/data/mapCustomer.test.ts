/**
 * mapCustomer — KLANT-FASE-1 lifecycle phase.
 *
 * The backend emits `phase` as a BARE SLUG on both the list and the detail resource,
 * and the column is null-safe there (`$this->phase ?? null`), so the mapper has to
 * tolerate null/absent without producing `undefined` — the table cell distinguishes
 * "no phase" (dash) from a real phase, and `undefined` would slip through that check
 * differently than ''. Colour/label are deliberately NOT mapped here: they come from
 * the /customer-phases lookup, so a tenant rename needs no re-fetch of the list.
 */
import { describe, it, expect } from 'vitest'
import { mapCustomer, mapCustomerNoteRow, mapLocation } from './mapCustomer'
import type { ApiCustomer, ApiLocation } from '@/types/customer'

describe('mapCustomer · phase (KLANT-FASE-1)', () => {
  it('carries the phase slug through untouched', () => {
    expect(mapCustomer({ id: 1, name: 'Zorgpartners', phase: 'klant' } as ApiCustomer).phase).toBe('klant')
  })

  it('maps a null or absent phase to an empty string, never undefined', () => {
    expect(mapCustomer({ id: 1, name: 'X', phase: null } as ApiCustomer).phase).toBe('')
    expect(mapCustomer({ id: 1, name: 'X' } as ApiCustomer).phase).toBe('')
  })

  it('keeps phase and status apart — they are two different axes', () => {
    const c = mapCustomer({
      id: 1, name: 'X', phase: 'prospect',
      // eslint-disable-next-line no-restricted-syntax -- DATA: fixture colour as the API returns it, not UI styling
      status: { value: 'active', label: 'Actief', color: '#16A34A' },
    } as ApiCustomer)
    expect(c.phase).toBe('prospect')
    expect(c.status).toBe('active')
  })
})

/**
 * NOTES-LOC-DEPT-1 — a note's optional location/department link. mapCustomerNoteRow
 * is the ONE row mapper shared by mapCustomer's embedded `notes[]` AND the scoped
 * notes endpoints (useScopedCustomerNotes) — covering it here covers both call sites.
 */
describe('mapCustomerNoteRow (NOTES-LOC-DEPT-1)', () => {
  it('maps the location link + level, leaving department/contact null', () => {
    const n = mapCustomerNoteRow({
      id: 'n-1', type: 'general', text: 'Bezoek gepland',
      customer_location_id: 'loc-1', location_name: 'Hoofdlocatie', level: 'location',
    })
    expect(n).toMatchObject({ locationId: 'loc-1', locationName: 'Hoofdlocatie', departmentId: null, departmentName: '', contactId: null, contactName: '', level: 'location' })
  })

  it('maps the department link + level', () => {
    const n = mapCustomerNoteRow({
      id: 'n-2', customer_department_id: 'dep-1', department_name: 'Verpleging', level: 'department',
    })
    expect(n).toMatchObject({ departmentId: 'dep-1', departmentName: 'Verpleging', locationId: null, level: 'department' })
  })

  it('a company-level note (no link at all) maps every link field to null/empty', () => {
    const n = mapCustomerNoteRow({ id: 'n-3', level: 'customer' })
    expect(n).toMatchObject({
      locationId: null, locationName: '', departmentId: null, departmentName: '', contactId: null, contactName: '',
    })
  })

  it('mapCustomer folds the same shape through its embedded notes[] field', () => {
    const c = mapCustomer({
      id: 1, name: 'X',
      notes: [{ id: 'n-1', customer_location_id: 'loc-1', location_name: 'Hoofdlocatie', level: 'location' }],
    } as ApiCustomer)
    expect(c.notes[0]).toMatchObject({ locationId: 'loc-1', locationName: 'Hoofdlocatie' })
  })
})

// TRASH-OVERAL-2: tolerant lifecycle mapping — server value first, stamps as the
// derivation fallback, and a bare/old payload stays 'active'/null (old fixtures work).
describe('mapCustomer · lifecycle (TRASH-OVERAL-2)', () => {
  it('reads the server lifecycle + pending_erase_at straight through', () => {
    const c = mapCustomer({ id: 1, name: 'X', lifecycle: 'pending_erase', pending_erase_at: '2026-08-10T10:00:00Z', deleted_at: '2026-08-01T10:00:00Z' } as ApiCustomer)
    expect(c.lifecycle).toBe('pending_erase')
    expect(c.pendingEraseAt).toBe('2026-08-10T10:00:00Z')
    expect(c.archived).toBe(true)
  })

  it('derives archived from deleted_at when the lifecycle field is absent', () => {
    const c = mapCustomer({ id: 1, name: 'X', deleted_at: '2026-08-01T10:00:00Z' } as ApiCustomer)
    expect(c.lifecycle).toBe('archived')
    expect(c.archivedAt).toBe('2026-08-01T10:00:00Z')
  })

  it('a payload without any of the fields stays active/null', () => {
    const c = mapCustomer({ id: 1, name: 'X' } as ApiCustomer)
    expect(c.lifecycle).toBe('active')
    expect(c.pendingEraseAt).toBeNull()
  })
})

/**
 * ONTKOPPEL-TELLER-1 — the detail-only, server-computed count of applications
 * CURRENTLY detached (soft-deleted, not restored) across ALL this customer's
 * vacancies. Whole-history, never the screen's active filter window.
 */
describe('mapCustomer · detachedCount', () => {
  it('reads detached_count from the API payload', () => {
    const c = mapCustomer({ id: 1, name: 'X', detached_count: 5 } as ApiCustomer)
    expect(c.detachedCount).toBe(5)
  })

  it('leaves detachedCount undefined when the field is absent, never a fabricated 0', () => {
    const c = mapCustomer({ id: 1, name: 'X' } as ApiCustomer)
    expect(c.detachedCount).toBeUndefined()
  })
})

/**
 * K-283 — a location's OWN single branch (branch_id/branch), a DIFFERENT field than
 * branchIds/branches (LOCATIE-VESTIGING-1's multi-branch visibility set). Mirrors
 * mapCustomer's own branch/branch_id read (BRANCH-1); only sent on routes that
 * eager-load it, so the mapper stays tolerant of null/absent.
 */
describe('mapLocation · branch (K-283)', () => {
  it('maps a present branch to branchId + branch {id,name}', () => {
    const l = mapLocation({ id: 'loc-1', name: 'Vestiging A', branch_id: 'b-1', branch: { id: 'b-1', name: 'Amsterdam' } } as ApiLocation)
    expect(l.branchId).toBe('b-1')
    expect(l.branch).toEqual({ id: 'b-1', name: 'Amsterdam' })
  })

  it('maps an explicit null branch to branchId null and branch null', () => {
    const l = mapLocation({ id: 'loc-1', name: 'Vestiging A', branch_id: null, branch: null } as ApiLocation)
    expect(l.branchId).toBeNull()
    expect(l.branch).toBeNull()
  })

  it('maps an absent branch (older/non-eager-loaded payload) to branchId null and branch null', () => {
    const l = mapLocation({ id: 'loc-1', name: 'Vestiging A' } as ApiLocation)
    expect(l.branchId).toBeNull()
    expect(l.branch).toBeNull()
  })

  it('falls back to branch_id when only the flat id is sent, without the nested branch object', () => {
    const l = mapLocation({ id: 'loc-1', name: 'Vestiging A', branch_id: 'b-2' } as ApiLocation)
    expect(l.branchId).toBe('b-2')
    expect(l.branch).toBeNull()
  })
})

// S1 K-266/K-267: the new koios_ai_advice cache — replaces the old, never-filled
// koios_advice field customer used to declare.
describe('mapCustomer · koiosAiAdvice', () => {
  it('maps the full detail block', () => {
    const c = mapCustomer({
      id: 1,
      koios_ai_advice: { verdict: 'opportunity', score: 70, text: 'Growing account.', language: 'nl', generated_at: '2026-09-01T07:00:00Z', run_id: 'run-3' },
    } as ApiCustomer)
    expect(c.koiosAiAdvice).toEqual({
      verdict: 'opportunity', score: 70, text: 'Growing account.', language: 'nl', generatedAt: '2026-09-01T07:00:00Z', runId: 'run-3',
    })
  })
  it('maps a compact list row', () => {
    const c = mapCustomer({ id: 1, koios_ai_advice: { verdict: 'risk', score: 20 } } as ApiCustomer)
    expect(c.koiosAiAdvice).toEqual({ verdict: 'risk', score: 20, text: null, language: null, generatedAt: null, runId: null })
  })
  it('stays null on an explicit null and on an absent key', () => {
    expect(mapCustomer({ id: 1, koios_ai_advice: null } as ApiCustomer).koiosAiAdvice).toBeNull()
    expect(mapCustomer({ id: 1 } as ApiCustomer).koiosAiAdvice).toBeNull()
  })
})

// LANE-I1b: address_line_2 on customer and location, billing_address_line_2 + billing_province.
describe('mapCustomer · address_line_2 and billing fields (LANE-I1b)', () => {
  it('maps address_line_2 on the customer visiting address', () => {
    const c = mapCustomer({ id: 1, name: 'X', address_line_2: 'Apartment 4B' } as ApiCustomer)
    expect(c.addressLine2).toBe('Apartment 4B')
  })

  it('defaults addressLine2 to empty string when absent', () => {
    const c = mapCustomer({ id: 1, name: 'X' } as ApiCustomer)
    expect(c.addressLine2).toBe('')
  })

  it('maps billing_address_line_2 and billing_province on the customer', () => {
    const c = mapCustomer({
      id: 1, name: 'X',
      billing_address_line_2: 'Suite 100', billing_province: 'North Holland',
    } as ApiCustomer)
    expect(c.billingAddressLine2).toBe('Suite 100')
    expect(c.billingProvince).toBe('North Holland')
  })

  it('defaults billing fields to empty strings when absent', () => {
    const c = mapCustomer({ id: 1, name: 'X' } as ApiCustomer)
    expect(c.billingAddressLine2).toBe('')
    expect(c.billingProvince).toBe('')
  })
})

// LANE-I1b: address_line_2 on customer location.
describe('mapLocation · address_line_2 (LANE-I1b)', () => {
  it('maps address_line_2 on a location', () => {
    const l = mapLocation({ id: 'loc-1', name: 'Main', address_line_2: 'Building B' } as ApiLocation)
    expect(l.addressLine2).toBe('Building B')
  })

  it('defaults addressLine2 to empty string when absent', () => {
    const l = mapLocation({ id: 'loc-1', name: 'Main' } as ApiLocation)
    expect(l.addressLine2).toBe('')
  })
})
