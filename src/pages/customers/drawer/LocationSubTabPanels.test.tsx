/**
 * LocationSubTabPanels — GEO-POLL-1: the location's GeocodeCard (Koppelingen tab)
 * must pass a `fetchEndpoint` (the per-location READ route) alongside `endpoint`,
 * or the shared useGeocodePoll never learns a queued re-geocode has landed and the
 * card sits stale until a manual reload (the CMD+R bug GEO-POLL-1 fixed elsewhere).
 * This test asserts the PROP, not just that the card renders.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LocationSubTabPanels from './LocationSubTabPanels'
import type { Location } from '@/types/customer'

// Every sibling sub-tab is irrelevant here — only the Koppelingen/GeocodeCard
// wiring is under test.
vi.mock('./ScopedVacanciesTab', () => ({ default: () => null }))
vi.mock('./ScopedApplicationsTab', () => ({ default: () => null }))
vi.mock('./ScopedNotesTab', () => ({ default: () => null }))
vi.mock('@/components/drawer/tabs/notes/LinkedNotesTab', () => ({ default: () => null }))
vi.mock('./ScopedDocumentsTab', () => ({ default: () => null }))
vi.mock('./ScopedMatchesTab', () => ({ default: () => null }))
vi.mock('./ScopedOpportunitiesTab', () => ({ default: () => null }))
vi.mock('@/components/drawer/tabs/EntityTasksTab', () => ({ default: () => null }))
vi.mock('@/components/drawer/CustomFieldsTab', () => ({ default: () => null }))
vi.mock('./SubEntityTimelineTab', () => ({ default: () => null }))
vi.mock('@/components/drawer/BackofficeLinksTab', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="backoffice-links">{children}</div>,
}))
vi.mock('@/components/drawer/GeocodeCard', () => ({
  default: (props: Record<string, unknown>) => <div data-testid="geocode-card" data-props={JSON.stringify(props)} />,
}))

const location = { id: 'loc-1', name: 'Vestiging A', lat: 52.1, lng: 5.1, city: 'Utrecht' } as unknown as Location
const t = (k: string) => k

describe('LocationSubTabPanels · GeocodeCard fetchEndpoint (GEO-POLL-1)', () => {
  it('passes fetchEndpoint to the per-location READ route, matching the POST endpoint\'s id path', () => {
    render(
      <LocationSubTabPanels subTab="links" location={location} customerId="cust-1" customerName="Klant BV"
        canLinkBackoffice onSave={vi.fn()} t={t} />
    )
    const props = JSON.parse(screen.getByTestId('geocode-card').getAttribute('data-props') ?? '{}')
    expect(props.endpoint).toBe('/customers/cust-1/locations/loc-1/geocode')
    expect(props.fetchEndpoint).toBe('/customers/cust-1/locations/loc-1')
  })

  it('leaves both endpoints undefined without a customerId (never a /customers/undefined/… call)', () => {
    render(
      <LocationSubTabPanels subTab="links" location={location} customerName="Klant BV"
        canLinkBackoffice onSave={vi.fn()} t={t} />
    )
    const props = JSON.parse(screen.getByTestId('geocode-card').getAttribute('data-props') ?? '{}')
    expect(props.endpoint).toBeUndefined()
    expect(props.fetchEndpoint).toBeUndefined()
  })
})
