import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVacancyFilterParams } from './useVacancyFilterParams'
import type { VacancyFilterState } from './useVacancyFilterParams'

// The params object IS the request: /vacancies and /vacancies/stats both send it
// verbatim, so these assert the wire keys, not "a state flag flipped".
const base = (over: Partial<VacancyFilterState> = {}): VacancyFilterState => ({
  globalSearch: '', statusBucket: 'all',
  selectedOwner: [], selectedClient: [], selectedCategory: [], selectedBranch: [],
  showArchived: false, showTrash: false, showWithoutAgent: false, selectedAgentId: null,
  hasApplications: false, publishedBucket: 'all',
  view: 'table', mapCenter: { lat: 52, lng: 5 }, mapRadius: 30, mapStraalActive: false,
  attention: null,
  ...over,
})
const params = (over: Partial<VacancyFilterState> = {}) =>
  renderHook(() => useVacancyFilterParams(base(over))).result.current

describe('useVacancyFilterParams · has_applications (VAC-HAS-APPLICATIONS-1)', () => {
  it('omits has_applications while the KPI filter is off', () => {
    expect(params()).not.toHaveProperty('has_applications')
  })

  it('sends has_applications=1 when the applications KPI is active', () => {
    expect(params({ hasApplications: true }).has_applications).toBe(1)
  })

  // Laravel's strict `boolean` rule rejects the "true"/"false" a querystring carries,
  // so the value must go out as a real number — not a JS boolean, not a string.
  it('sends a numeric value, not the "true" string that 422s', () => {
    expect(typeof params({ hasApplications: true }).has_applications).toBe('number')
  })

  it('combines with the other filters instead of replacing them', () => {
    const p = params({ hasApplications: true, statusBucket: 's1', selectedOwner: ['u1'] })
    expect(p).toMatchObject({ has_applications: 1, status: ['s1'], owner_id: ['u1'] })
  })
})

describe('useVacancyFilterParams · the existing filter shapes stay intact', () => {
  it('maps a reference query to ?ref= and free text to ?search=', () => {
    expect(params({ globalSearch: 'V-00100' })).toMatchObject({ ref: 'V-00100' })
    expect(params({ globalSearch: 'verpleegkundige' })).toMatchObject({ search: 'verpleegkundige' })
  })

  it('maps the "Geen status" bucket to no_status and a real status to status[]', () => {
    expect(params({ statusBucket: '__none' })).toMatchObject({ no_status: 1 })
    expect(params({ statusBucket: 'open' })).toMatchObject({ status: ['open'] })
  })

  it('sends published as 1/0 and keeps without_agent exclusive with agent_id', () => {
    expect(params({ publishedBucket: 'unpublished' }).published).toBe(0)
    const p = params({ showWithoutAgent: true, selectedAgentId: 'a1' })
    expect(p).toMatchObject({ without_agent: 1 })
    expect(p).not.toHaveProperty('agent_id')
  })

  it('only sends the radius circle once the map filter is activated', () => {
    expect(params({ view: 'map' })).not.toHaveProperty('radius')
    expect(params({ view: 'map', mapStraalActive: true })).toMatchObject({ lat: 52, lng: 5, radius: 30 })
  })
})

// D1(a): the dashboard's "closing soon" / "stale status" tiles land here via a
// semantic { attention } intent (VacanciesPage's own intent-seeding effect) —
// this asserts the REQUEST the hook actually produces from that intent, not
// merely that a setter fired.
describe('useVacancyFilterParams · D1(a) dashboard attention intent', () => {
  it('omits both attention filters while none is active', () => {
    const p = params()
    expect(p).not.toHaveProperty('closing_soon')
    expect(p).not.toHaveProperty('stale_status')
  })

  it('sends closing_soon=1 for the closingSoon intent', () => {
    expect(params({ attention: 'closingSoon' })).toMatchObject({ closing_soon: 1 })
  })

  it('sends stale_status=1 for the staleStatus intent', () => {
    expect(params({ attention: 'staleStatus' })).toMatchObject({ stale_status: 1 })
  })
})

// TRASH-OVERAL-2: the Prullenbak view rides the SAME include_archived request as
// the archived view (the page splits the result client-side on lifecycle).
describe('useVacancyFilterParams · trash view (TRASH-OVERAL-2)', () => {
  it('sends include_archived=1 for the trash view', () => {
    expect(params({ showTrash: true }).include_archived).toBe(1)
  })

  it('omits include_archived while both soft-delete views are off', () => {
    expect(params()).not.toHaveProperty('include_archived')
  })
})
