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
