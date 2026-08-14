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
import { mapCustomer, mapCustomerNoteRow } from './mapCustomer'
import type { ApiCustomer } from '@/types/customer'

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
