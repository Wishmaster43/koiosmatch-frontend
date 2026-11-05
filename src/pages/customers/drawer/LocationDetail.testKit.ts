/** Shared DATA fixtures for the LocationDetail suites (plain data, no mocks). */
import type { Location } from '@/types/customer'
import type { LookupOption } from '@/types/common'

// Hex values here are DATA — fixture colours for a tenant lookup, not UI styling.
export const statuses: LookupOption[] = [
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-active', label: 'Actief', color: '#22C55E', id: 'status-active' },
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-inactive', label: 'Inactief', color: '#9CA3AF', id: 'status-inactive' },
]

export const location = (overrides: Partial<Location> = {}): Location => ({
  id: 'loc-1', helloflexLink: null, shiftmanagerLink: null, name: 'Hoofdlocatie',
  street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', state: '', country: '',
  cocNumber: '', vatNumber: '', contactName: '', phone: '', email: '', isHeadquarter: false,
  costCenter: '', billingEmail: '', address: '', description: '', departments: [], contacts: [],
  // LOCATIE-VESTIGING-1 — no own couplings, so this site inherits the customer's.
  branchIds: [], branches: [], branchInherited: true, effectiveBranches: [],
  // K-283 — this site's OWN single branch; null by default (not eager-loaded/unset).
  branchId: null, branch: null,
  lat: null, lng: null,
  statusId: 'status-active', status: 'active', statusLabel: 'Actief',
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  statusColor: '#22C55E',
  customFields: {},
  ...overrides,
} as Location)
