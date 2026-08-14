import { describe, it, expect } from 'vitest'
import { mapOpportunity } from './mapOpportunity'

describe('mapOpportunity', () => {
  it('maps a snake_case API row with nested objects', () => {
    const row = mapOpportunity({
      id: 'o1', title: 'Zorggroep Noord',
      customer: { id: 'c1', name: 'Zorggroep Noord BV' },
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      stage_label: 'Voorstel', stage_color: '#6E8FD6',
      value: 42000,
      owner: { id: 'u1', name: 'Kelly van Vliet' },
      created_at: '2026-06-16',
    })
    expect(row).toMatchObject({
      id: 'o1', title: 'Zorggroep Noord', client: 'Zorggroep Noord BV',
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      stage: 'Voorstel', stageColor: '#6E8FD6', value: 42000,
      owner: 'Kelly van Vliet', date: '2026-06-16', initials: 'ZN',
    })
  })

  it('extracts label + color from the nested API stage object', () => {
    const row = mapOpportunity({
      id: 'o1b', title: 'Deal Z',
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      stage: { value: 'proposal', label: 'Voorstel', color: '#6E8FD6' },
    })
    expect(row.stage).toBe('Voorstel')
    expect(row.stageValue).toBe('proposal')
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    expect(row.stageColor).toBe('#6E8FD6')
  })

  it('exposes the nested ids (stage/owner/customer) the drawer pickers need', () => {
    const row = mapOpportunity({
      id: 'o1c', title: 'Deal Q', currency: 'EUR',
      customer: { id: 'c9', name: 'Klant Q' },
      owner: { id: 'u9', name: 'Sam' },
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      stage: { value: 'won', label: 'Gewonnen', color: '#79B58E' },
      expected_close_at: '2026-08-01',
    })
    expect(row.clientId).toBe('c9')
    expect(row.ownerId).toBe('u9')
    expect(row.stageValue).toBe('won')
    expect(row.currency).toBe('EUR')
    expect(row.expectedCloseAt).toBe('2026-08-01')
  })

  it('tolerates alternate keys (name · client · deal_value · expected_close_at)', () => {
    const row = mapOpportunity({
      id: 'o2', name: 'Deal Y', client: { name: 'Klant Y' },
      stage: 'Lead', deal_value: 15000, owner_name: 'Sam', expected_close_at: '2026-07-01',
    })
    expect(row).toMatchObject({
      title: 'Deal Y', client: 'Klant Y', stage: 'Lead',
      // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
      value: 15000, owner: 'Sam', date: '2026-07-01', stageColor: '#6E8FD6',
    })
  })

  it('coerces a non-numeric value to null and accepts amount as a fallback', () => {
    expect(mapOpportunity({ id: 'o3', value: 'n/a' }).value).toBeNull()
    expect(mapOpportunity({ id: 'o4', amount: 9000 }).value).toBe(9000)
  })

  it('falls back to client initials when the title is missing', () => {
    const row = mapOpportunity({ customer: { name: 'Alpha Beta' } })
    expect(row.title).toBe('—')
    expect(row.client).toBe('Alpha Beta')
    expect(row.initials).toBe('AB')
  })

  it('reads the customer\'s OWN location (customer_location), not the tenant branch (location)', () => {
    // Regression (2026-07-14): the mapper used to read `location`/`location_id`
    // (the tenant's own branch, C-41) for the Klant tab's location field, which
    // silently prefilled an empty/wrong pick in the drawer's edit-mode cascade —
    // the real column is `customer_location`/`customer_location_id` (OPP-LOC-1).
    const row = mapOpportunity({
      id: 'o5',
      location: { id: 'branch-1', name: 'Bureau Amsterdam' },
      customer_location: { id: 'loc-9', name: 'Kantoor Rotterdam' },
    })
    expect(row.location).toBe('Kantoor Rotterdam')
    expect(row.locationId).toBe('loc-9')
    // K2: the same `location` object now ALSO surfaces as branch/branchId — the
    // AddOpportunityModal Vestiging picker's edit-mode prefill.
    expect(row.branch).toBe('Bureau Amsterdam')
    expect(row.branchId).toBe('branch-1')
  })

  it('falls back to the flat location_id when nested location (branch) is absent (K2)', () => {
    const row = mapOpportunity({ id: 'o5b', location_id: 'branch-42' })
    expect(row.branchId).toBe('branch-42')
    expect(row.branch).toBe('')
  })

  it('falls back to the flat customer_location_id when nested customer_location is absent', () => {
    const row = mapOpportunity({ id: 'o6', customer_location_id: 'loc-42' })
    expect(row.locationId).toBe('loc-42')
  })

  it('maps archived + deleted_at onto the row (ARCHIVE-1)', () => {
    const row = mapOpportunity({ id: 'o7', archived: true, deleted_at: '2026-07-10T00:00:00Z' })
    expect(row.archived).toBe(true)
    expect(row.archivedAt).toBe('2026-07-10T00:00:00Z')
  })

  it('defaults archived to false when the resource omits both fields', () => {
    const row = mapOpportunity({ id: 'o8' })
    expect(row.archived).toBe(false)
    expect(row.archivedAt).toBeNull()
  })

  it('maps description through (OPP-DESCRIPTION-1), coalescing null to an empty string', () => {
    const row = mapOpportunity({ id: 'o9', description: '<p>Kanstekst</p>' })
    expect(row.description).toBe('<p>Kanstekst</p>')
    expect(mapOpportunity({ id: 'o10', description: null }).description).toBe('')
    expect(mapOpportunity({ id: 'o11' }).description).toBe('')
  })

  it('never throws on an empty record and fills safe defaults', () => {
    const row = mapOpportunity({})
    expect(row.title).toBe('—')
    expect(row.client).toBe('—')
    expect(row.stage).toBe('')
    // eslint-disable-next-line no-restricted-syntax -- test fixture hex, not a UI colour
    expect(row.stageColor).toBe('#6E8FD6')
    expect(row.value).toBeNull()
    expect(row.owner).toBe('')
    expect(row.initials).toBe('?')
  })
})

// TRASH-OVERAL-2: tolerant lifecycle mapping — server value first, stamps as the
// derivation fallback, and a bare/old payload stays 'active'/null.
describe('mapOpportunity · lifecycle (TRASH-OVERAL-2)', () => {
  it('reads the server lifecycle + pending_erase_at straight through', () => {
    const row = mapOpportunity({ id: 'o1', lifecycle: 'pending_erase', pending_erase_at: '2026-08-10T10:00:00Z', deleted_at: '2026-08-01T10:00:00Z' })
    expect(row.lifecycle).toBe('pending_erase')
    expect(row.pendingEraseAt).toBe('2026-08-10T10:00:00Z')
    expect(row.archived).toBe(true)
  })

  it('derives archived from the stamps when the lifecycle field is absent, and stays active on a bare payload', () => {
    expect(mapOpportunity({ id: 'o1', deleted_at: '2026-08-01T10:00:00Z' }).lifecycle).toBe('archived')
    expect(mapOpportunity({ id: 'o1' }).lifecycle).toBe('active')
    expect(mapOpportunity({ id: 'o1' }).pendingEraseAt).toBeNull()
  })
})
