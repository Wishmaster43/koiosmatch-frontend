/**
 * LocationsTab · status column colour on/off flag (CHIPKLEUR-INSTELBAAR-1). The
 * status chip in the locations table reads `customer_location_table_color_status`
 * (default ON, mirrors ContactsPanel/DepartmentsPanel's own flags) — an absent
 * setting must keep today's coloured-chip look; turning it off falls back to
 * plain text without losing the label (§6 — colour is never the only signal).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import LocationsTab from './LocationsTab'
import type { Location } from '@/types/customer'

const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

// Defensive mocks — LocationsTab only renders the list (no row is clicked here), but
// its module graph pulls in LocationDetail/AddLocationModal, which reach these hooks.
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrap: (r: { data?: unknown }) => r?.data, unwrapList: () => ({ rows: [], total: 0 }),
  // The real (unmocked) useAllSettings module reads this to tenant-scope its cache —
  // this file relies on the REAL module (see invalidateAllSettingsCache import above).
  getActiveTenantId: vi.fn(() => null),
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

/**
 * DRILL-PAGER-1 (Danny 02-08: "moeten er pijltjes komen zodat je vanuit één
 * contactpersoon naar de volgende kan en terug" — same request, top-level Locaties
 * tab). The pager must step through EXACTLY the rows the user was looking at: with
 * the status filter narrowing three locations to two, "next" must never land on the
 * filtered-out third one, and the counter must report against the FILTERED total
 * (2), not the wider unscoped one (3). This also proves LocationsTab's own move off
 * SubEntityTab (see the file header) still opens/steps locations correctly.
 */
describe('LocationsTab · pager steps through the caller\'s OWN filtered rows (DRILL-PAGER-1)', () => {
  // A prior describe block's LAST test leaves a custom /settings mockImplementation
  // behind (mockClear() clears call history, never a mocked implementation) — reset
  // it explicitly so this block's "no configured default" assumption holds regardless
  // of file execution order.
  beforeEach(() => vi.mocked(api.get).mockImplementation(() => Promise.resolve({ data: { data: [] } })))

  const statuses = [
    { id: 'status-active', value: 'active', label: 'Actief' },
    { id: 'status-inactive', value: 'inactive', label: 'Inactief' },
  ]
  const threeLocations = [
    location({ id: 'loc-a', name: 'Vestiging Alpha', statusId: 'status-active', statusLabel: 'Actief' }),
    location({ id: 'loc-b', name: 'Vestiging Bravo', statusId: 'status-active', statusLabel: 'Actief' }),
    // Filtered OUT by the default "active only" guess — proves the pager counts ONLY
    // what the status filter actually shows, never the wider unscoped list.
    location({ id: 'loc-c', name: 'Vestiging Charlie', statusId: 'status-inactive', statusLabel: 'Inactief' }),
  ]

  it('pages to the next VISIBLE location, never the one the filter hid, and disables at each end', async () => {
    const user = userEvent.setup()
    render(<LocationsTab {...base} locations={threeLocations} statuses={statuses} />)

    await waitFor(() => expect(screen.getByText('Vestiging Alpha')).toBeInTheDocument())
    // The filter really did narrow the list — the scoping this pager must respect.
    expect(screen.queryByText('Vestiging Charlie')).toBeNull()

    await user.click(screen.getByText('Vestiging Alpha'))
    // First of TWO visible locations (never three) — prev is honestly disabled here.
    expect(screen.getByTitle(cm('drillPager.nextAt', { index: 1, total: 2 }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: cm('drillPager.prev') })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: cm('drillPager.next') }))
    // Landed on the SECOND visible location, never the filtered-out third. The name
    // legitimately repeats on screen (breadcrumb "current" + title + a Gegevens field
    // row), so scope to the breadcrumb, which is the one spot it can only mean "this
    // is the record now open".
    expect(within(screen.getByRole('navigation')).getByText('Vestiging Bravo')).toBeInTheDocument()
    expect(screen.getByTitle(cm('drillPager.nextAt', { index: 2, total: 2 }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: cm('drillPager.next') })).toBeDisabled()
  })
})

/**
 * CONTACT-PRIMAIR-LOCATIE-2: `onAddContact` used to be threaded all the way down
 * to LocationDetail's nested contact list but never reached AddLocationModal's own
 * "+ Locatie toevoegen" popup — so a typed brand-new "contact ter plaatse" name had
 * no way to become a real contact record. Proves the real handler (not just any
 * function) actually arrives at the modal by driving the whole create flow through
 * this component, exactly the way CustomerDrawer wires it in production.
 */
describe('LocationsTab · threads the real onAddContact into AddLocationModal (CONTACT-PRIMAIR-LOCATIE-2)', () => {
  it('a typed brand-new "contact ter plaatse" name reaches the onAddContact this tab received as a prop', async () => {
    const user = userEvent.setup()
    const onAddLocation = vi.fn().mockResolvedValue({ id: 'loc-99', name: 'Hoofdlocatie' })
    const onAddContact = vi.fn().mockResolvedValue(undefined)
    render(<LocationsTab {...base} onAddLocation={onAddLocation} onAddContact={onAddContact} />)

    await user.click(screen.getByRole('button', { name: ct('locations.add') }))
    // The trigger click is scoped to the dialog: the table BEHIND it also has a
    // sortable "Naam" column header — subModal.contactName resolves to the same
    // word, so an unscoped query would collide with it. The picker's OWN dropdown
    // (search input + option buttons) renders in a portal outside the dialog once
    // open, so those later queries stay on the unscoped `screen`.
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(ct('subModal.locationName'), { exact: false }), 'Hoofdlocatie')
    await user.click(dialog.getByRole('button', { name: new RegExp(ct('subModal.contactName')) }))
    const search = screen.getByPlaceholderText(ct('subModal.contactName'))
    await user.type(search, 'Nieuwe Persoon')
    await user.click(screen.getByRole('button', { name: /Nieuwe Persoon/ }))
    await user.click(dialog.getByRole('button', { name: ct('subModal.create') }))

    // Reached with the split-name payload — proves it is the REAL add handler, not dropped.
    await waitFor(() => expect(onAddContact).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Nieuwe', lastName: 'Persoon' })))
  })
})

/**
 * ARCHIVE-SUBENTITY-1 — the "Gearchiveerd" quick-view is a SEPARATE fetch (never
 * merged into the live list), gated entirely on the toggle (no request while off).
 * Assert the REQUEST (§13): the exact `include_archived=1` param, not just that
 * some state flipped.
 */
describe('LocationsTab · Gearchiveerd quick-view (ARCHIVE-SUBENTITY-1)', () => {
  it('fires no archived-list request until the toggle is switched on', () => {
    render(<LocationsTab {...base} />)
    expect(vi.mocked(api.get).mock.calls.some(([, cfg]) => (cfg as { params?: { include_archived?: number } } | undefined)?.params?.include_archived === 1)).toBe(false)
  })

  it('requests include_archived=1 for this customer\'s own locations once toggled on', async () => {
    const user = userEvent.setup()
    render(<LocationsTab {...base} />)

    await user.click(screen.getByRole('button', { name: ct('locations.archivedView') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/cust-1/locations', expect.objectContaining({ params: { include_archived: 1 } })))
  })
})
