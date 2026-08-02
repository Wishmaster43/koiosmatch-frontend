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
import { mapCustomer } from './mapCustomer'
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
