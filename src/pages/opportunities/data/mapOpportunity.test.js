import { describe, it, expect } from 'vitest'
import { mapOpportunity } from './mapOpportunity'

describe('mapOpportunity', () => {
  it('maps a snake_case API row with nested objects', () => {
    const row = mapOpportunity({
      id: 'o1', title: 'Zorggroep Noord',
      customer: { id: 'c1', name: 'Zorggroep Noord BV' },
      stage_label: 'Voorstel', stage_color: '#6E8FD6',
      value: 42000,
      owner: { id: 'u1', name: 'Kelly van Vliet' },
      created_at: '2026-06-16',
    })
    expect(row).toMatchObject({
      id: 'o1', title: 'Zorggroep Noord', client: 'Zorggroep Noord BV',
      stage: 'Voorstel', stageColor: '#6E8FD6', value: 42000,
      owner: 'Kelly van Vliet', date: '2026-06-16', initials: 'ZN',
    })
  })

  it('extracts label + color from the nested API stage object', () => {
    const row = mapOpportunity({
      id: 'o1b', title: 'Deal Z',
      stage: { value: 'proposal', label: 'Voorstel', color: '#6E8FD6' },
    })
    expect(row.stage).toBe('Voorstel')
    expect(row.stageValue).toBe('proposal')
    expect(row.stageColor).toBe('#6E8FD6')
  })

  it('exposes the nested ids (stage/owner/customer) the drawer pickers need', () => {
    const row = mapOpportunity({
      id: 'o1c', title: 'Deal Q', currency: 'EUR',
      customer: { id: 'c9', name: 'Klant Q' },
      owner: { id: 'u9', name: 'Sam' },
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
  })

  it('falls back to the flat customer_location_id when nested customer_location is absent', () => {
    const row = mapOpportunity({ id: 'o6', customer_location_id: 'loc-42' })
    expect(row.locationId).toBe('loc-42')
  })

  it('never throws on an empty record and fills safe defaults', () => {
    const row = mapOpportunity({})
    expect(row.title).toBe('—')
    expect(row.client).toBe('—')
    expect(row.stage).toBe('')
    expect(row.stageColor).toBe('#6E8FD6')
    expect(row.value).toBeNull()
    expect(row.owner).toBe('')
    expect(row.initials).toBe('?')
  })
})
