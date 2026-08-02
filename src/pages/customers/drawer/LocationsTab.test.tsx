/**
 * LocationsTab · status column colour on/off flag (CHIPKLEUR-INSTELBAAR-1). The
 * status chip in the locations table reads `customer_location_table_color_status`
 * (default ON, mirrors ContactsPanel/DepartmentsPanel's own flags) — an absent
 * setting must keep today's coloured-chip look; turning it off falls back to
 * plain text without losing the label (§6 — colour is never the only signal).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import LocationsTab from './LocationsTab'
import type { Location } from '@/types/customer'

// Defensive mocks — LocationsTab only renders the list (no row is clicked here), but
// its module graph pulls in LocationDetail/AddLocationModal, which reach these hooks.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrap: (r: { data?: unknown }) => r?.data, unwrapList: () => ({ rows: [], total: 0 }),
}))
vi.mock('@/lib/useCustomFields', () => ({
  useCustomFields: () => ({ fields: [], allFields: [], loading: false, invalidate: () => {} }),
}))
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [] }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const location = (overrides: Partial<Location> = {}): Location => ({
  id: 'loc-1', helloflexLink: null, shiftmanagerLink: null, name: 'Hoofdlocatie',
  street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: 'Utrecht', state: '', country: '',
  cocNumber: '', vatNumber: '', contactName: '', phone: '', email: '', isHeadquarter: false,
  costCenter: '', billingEmail: '', address: '', departments: [], contacts: [],
  branchIds: [], branches: [], branchInherited: true, effectiveBranches: [],
  lat: null, lng: null,
  statusId: 'status-active', status: 'active', statusLabel: 'Actief',
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  statusColor: '#22C55E',
  customFields: {},
  ...overrides,
} as Location)

const base = {
  customerId: 'cust-1', locations: [location()], departments: [], contacts: [], statuses: [],
  onAddLocation: vi.fn(), onSaveLocation: vi.fn(), onDeleteLocation: vi.fn(),
  onAddDepartment: vi.fn(), onUpdateDepartment: vi.fn(), onRemoveDepartment: vi.fn(),
  onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(),
}

beforeEach(() => { vi.clearAllMocks(); invalidateAllSettingsCache() })

describe('LocationsTab · status colour on/off flag (CHIPKLEUR-INSTELBAAR-1)', () => {
  it('keeps the status chip coloured when no flag is saved (today\'s behaviour)', async () => {
    render(<LocationsTab {...base} />)
    // eslint-disable-next-line no-restricted-syntax -- DATA: fixture colour mirrors the tenant lookup colour set on `location()` above
    await waitFor(() => expect(screen.getByText('Actief')).toHaveStyle({ color: '#22C55E' }))
  })

  it('renders the status chip as plain text once the flag is turned off', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_location_table_color_status: 'false' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<LocationsTab {...base} />)
    // The label survives — only the colour is dropped.
    await waitFor(() => expect(screen.getByText('Actief')).toHaveStyle({ color: 'var(--text)' }))
  })
})

// TENANT-DEFAULT-1 (Danny 02-08): the tenant-configured default status filter replaces
// the frontend's own "active only" guess for this tab.
describe('LocationsTab · tenant-configured default status filter (TENANT-DEFAULT-1)', () => {
  const twoLocations = [
    location({ id: 'loc-active', name: 'Actieve locatie', statusId: 'status-active', statusLabel: 'Actief' }),
    location({ id: 'loc-inactive', name: 'Inactieve locatie', statusId: 'status-inactive', statusLabel: 'Inactief' }),
  ]
  const statuses = [
    { id: 'status-active', value: 'active', label: 'Actief' },
    { id: 'status-inactive', value: 'inactive', label: 'Inactief' },
  ]

  it('still guesses "active only" when no default is configured (today\'s behaviour)', async () => {
    render(<LocationsTab {...base} locations={twoLocations} statuses={statuses} />)
    await waitFor(() => expect(screen.getByText('Actieve locatie')).toBeInTheDocument())
    expect(screen.queryByText('Inactieve locatie')).toBeNull()
  })

  it('applies the configured default status when the tab opens', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_location_default_status_filter: 'status-inactive' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<LocationsTab {...base} locations={twoLocations} statuses={statuses} />)
    await waitFor(() => expect(screen.getByText('Inactieve locatie')).toBeInTheDocument())
    expect(screen.queryByText('Actieve locatie')).toBeNull()
  })

  it('an explicit "all" default shows every row, ignoring the active-only guess', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_location_default_status_filter: 'all' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<LocationsTab {...base} locations={twoLocations} statuses={statuses} />)
    await waitFor(() => {
      expect(screen.getByText('Actieve locatie')).toBeInTheDocument()
      expect(screen.getByText('Inactieve locatie')).toBeInTheDocument()
    })
  })
})
