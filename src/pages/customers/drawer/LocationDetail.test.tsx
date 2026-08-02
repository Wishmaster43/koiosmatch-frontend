/**
 * LocationDetail · title-row status badge (Danny 28-07: "Status van locatie moet
 * hier!!") — status moved OUT of the Algemeen field table into a read-only
 * TitleBadge next to the location name (§3A(c)), with its own pencil → picker →
 * save/cancel cycle so changing it is still possible. Assert the onSave PATCH
 * shape (§13), never only that a callback fired.
 *
 * EditableFieldTable pulls in `@/lib/datetime`, which side-effect-imports the
 * real i18n instance — so (like AddCustomerModal.test.tsx) this file resolves
 * assertions through the ACTIVE locale's own copy instead of guessing/hardcoding
 * a language.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import LocationDetail from './LocationDetail'
import type { Contact, Location } from '@/types/customer'
import type { LookupOption } from '@/types/common'

// useCustomFields hits the API in an effect — stub it so the Extra sub-tab stays
// hidden (no custom fields defined) and no network call happens under test.
// useLocations is react-query-backed (the Vestiging block's option list) — mocked so
// this test needs no QueryClientProvider, mirroring OverviewTab.test.tsx.
vi.mock('@/lib/useLocations', () => ({ useLocations: () => [{ value: 'br-1', label: 'Vestiging Noord' }] }))
vi.mock('@/lib/useCustomFields', () => ({
  useCustomFields: () => ({ fields: [], allFields: [], loading: false, invalidate: () => {} }),
}))
// KLANTLOCATIE-GEOCODE-1: the Koppelingen sub-tab's PDOK card fires a REAL POST, so the
// client is stubbed (get too — useProvinces reads /provinces on mount) while the module's
// named helpers stay real. GeocodeButton hides itself without the permission, so useAuth
// is stubbed to grant it; hasModule stays false, exactly like the unprovided context did.
const mockPost = vi.fn()
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: {
      get: vi.fn().mockResolvedValue({ data: [] }),
      post: (...args: unknown[]) => mockPost(...args),
      patch: vi.fn(), delete: vi.fn(),
    },
  }
})
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true, hasModule: () => false }),
}))
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

beforeEach(() => { vi.clearAllMocks(); mockPost.mockResolvedValue({ status: 202, data: {} }) })

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string) => i18n.t(key, { ns: 'common' })

// Hex values here are DATA — fixture colours for a tenant lookup, not UI styling.
const statuses: LookupOption[] = [
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-active', label: 'Actief', color: '#22C55E', id: 'status-active' },
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  { value: 'status-inactive', label: 'Inactief', color: '#9CA3AF', id: 'status-inactive' },
]

const location = (overrides: Partial<Location> = {}): Location => ({
  id: 'loc-1', helloflexLink: null, shiftmanagerLink: null, name: 'Hoofdlocatie',
  street: '', houseNumber: '', houseNumberSuffix: '', postalCode: '', city: '', state: '', country: '',
  cocNumber: '', vatNumber: '', contactName: '', phone: '', email: '', isHeadquarter: false,
  costCenter: '', billingEmail: '', address: '', departments: [], contacts: [],
  // LOCATIE-VESTIGING-1 — no own couplings, so this site inherits the customer's.
  branchIds: [], branches: [], branchInherited: true, effectiveBranches: [],
  lat: null, lng: null,
  statusId: 'status-active', status: 'active', statusLabel: 'Actief',
  // eslint-disable-next-line no-restricted-syntax -- DATA fixture, mirrors a tenant lookup colour
  statusColor: '#22C55E',
  customFields: {},
  ...overrides,
} as Location)

// Every required prop the component reads — kept minimal, only onSave is asserted.
const baseProps = {
  customerId: 'cust-1', locations: [], departments: [], contacts: [],
  statuses, departmentStatuses: [] as LookupOption[], contactStatuses: [] as LookupOption[],
  onDelete: vi.fn(), onAddDepartment: vi.fn(), onUpdateDepartment: vi.fn(), onRemoveDepartment: vi.fn(),
  onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(), close: vi.fn(),
}

describe('LocationDetail · title-row status badge', () => {
  it('renders the status as a read-only badge next to the name, not a field-table row', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    // The badge shows the resolved label.
    expect(screen.getByText('Actief')).toBeInTheDocument()
    // The pencil to change it sits right there in the title row.
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
  })

  it('renders no badge (but still an edit affordance) when the location carries no status yet', () => {
    render(<LocationDetail location={location({ statusId: null, status: '', statusLabel: '', statusColor: '' })} onSave={vi.fn()} {...baseProps} />)
    expect(screen.queryByText('Actief')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('locations.detail.changeStatus') })).toBeInTheDocument()
  })

  it('pencil reveals a picker seeded with the current status; picking another value + save PATCHes statusId', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    // Seeded with the current value — the trigger shows "Actief" (closed dropdown, one match).
    await user.click(screen.getByRole('button', { name: 'Actief' }))
    await user.click(screen.getByRole('button', { name: 'Inactief' }))
    await user.click(screen.getByRole('button', { name: cm('save') }))

    expect(onSave).toHaveBeenCalledWith('loc-1', { statusId: 'status-inactive' })
    // Back to read-only badge display — the local edit state must have closed.
    expect(screen.queryByRole('button', { name: cm('save') })).not.toBeInTheDocument()
  })

  it('cancel discards the draft without calling onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location()} onSave={onSave} {...baseProps} />)

    await user.click(screen.getByRole('button', { name: ct('locations.detail.changeStatus') }))
    await user.click(screen.getByRole('button', { name: cm('cancel') }))

    expect(onSave).not.toHaveBeenCalled()
    // The badge is back.
    expect(screen.getByText('Actief')).toBeInTheDocument()
  })

  it('the Algemeen field table no longer has its own status row (moved to the title)', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps} />)
    // Only ONE "Actief" on screen — the title badge — not a second one inside a field row.
    expect(screen.getAllByText('Actief')).toHaveLength(1)
  })
})

/**
 * KLANTLOCATIE-GEOCODE-1 (backend 2026-08-01) — until today the customer LOCATION was the
 * only geocodable record without a per-record re-geocode route, so its PDOK card could
 * only read. The route now exists and the card acts, mirroring the customer's own card.
 * Assert the REQUEST (§13): a card that renders a button which POSTs the wrong URL is a
 * 404 nobody sees, which is exactly the failure this test exists to catch.
 */
const openKoppelingen = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('tab', { name: cm('backofficeLinks.tabLabel') }))

describe('LocationDetail · PDOK card in Koppelingen', () => {
  it('POSTs the per-location geocode route, addressed through its customer', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem' })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)

    await user.click(screen.getByRole('button', { name: cm('geocode.refresh') }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/locations/loc-1/geocode')
  })

  it('renders the coordinates it already has instead of "not geocoded"', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem', lat: 51.8367, lng: 4.9705 })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)
    expect(screen.getByText('51.83670, 4.97050')).toBeInTheDocument()
    expect(screen.queryByText(cm('backofficeLinks.pdok.notGeocoded'))).not.toBeInTheDocument()
  })

  it('disables the trigger and fires nothing while the site has no address worth geocoding', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: '' })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)

    const btn = screen.getByRole('button', { name: cm('geocode.refresh') })
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('stays honestly read-only (no trigger at all) when there is no customer to address the route through', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem' })} onSave={vi.fn()} {...baseProps} customerId={undefined} />)
    await openKoppelingen(user)

    expect(screen.queryByRole('button', { name: cm('geocode.refresh') })).toBeNull()
    expect(screen.getByText(cm('backofficeLinks.pdok.readOnly'))).toBeInTheDocument()
  })

  it('never fires the geocode POST on mount — only on an explicit click', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location({ city: 'Gorinchem' })} onSave={vi.fn()} {...baseProps} />)
    await openKoppelingen(user)
    expect(mockPost).not.toHaveBeenCalled()
  })
})

/**
 * CONTACT-LOCATION-PRIMARY-1 — THE original complaint. A location used to carry only free
 * text ("Contact ter plaatse") and the screen GUESSED which contact record the typed name
 * meant: it matched on the name, gave up when two people shared one, and when it did match
 * it could open somebody who was never meant. Danny: "je typt Joost de Boer en Joost weet
 * van niets."
 *
 * The real link now exists (customer_contact_customer_location.is_primary), so the site's
 * primary contact is RESOLVED, not guessed. These assert both halves: the real link is
 * there, and the guess is gone — including in the case the old code handled "successfully"
 * (exactly one name match), which is the one that quietly opened the wrong person.
 */
const contactFixture = (over: Partial<Contact> = {}): Contact => ({
  id: 'con-1', helloflexLink: null, shiftmanagerLink: null, customerId: 'cust-1',
  firstName: 'Joost', middleName: 'de', lastName: 'Boer', name: 'Joost de Boer', role: 'Teamleider',
  email: 'joost@klant.test', phone: '', mobile: '', gender: '', isPrimary: false,
  locationId: 'loc-1', locationName: '', departmentId: null, departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '',
  lastContactAt: null, lastContactType: null, customFields: {},
  ...over,
} as Contact)

// The per-location primary flags ride along on the row, exactly as useCustomerContacts
// attaches them (see primaryLocationIdsOf).
const primaryAt = (locationIds: string[], over: Partial<Contact> = {}): Contact =>
  ({ ...contactFixture(over), primaryLocationIds: locationIds } as Contact)

describe('LocationDetail · primary contact of THIS site', () => {
  it('resolves the site\'s primary contact from the coupling flag and links to the real record', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps}
      contacts={[primaryAt(['loc-1'])]} />)

    const link = screen.getByRole('button', { name: 'Joost de Boer' })
    expect(link).toBeInTheDocument()
    // It opens THAT contact's own screen, on the Contactpersonen sub-tab.
    await user.click(link)
    expect(screen.getByText(ct('contacts.detail.infoTitle'))).toBeInTheDocument()
  })

  it('ignores a primary flag for a DIFFERENT site — this one then has none', () => {
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps}
      contacts={[primaryAt(['loc-2'])]} />)

    expect(screen.getByText(ct('locations.detail.noPrimaryContact'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Joost de Boer' })).toBeNull()
  })

  it('states plainly that none is set and offers the one place that sets it', async () => {
    const user = userEvent.setup()
    render(<LocationDetail location={location()} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture()]} />)

    expect(screen.getByText(ct('locations.detail.noPrimaryContact'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: ct('locations.detail.pickPrimaryContact') }))
    // Lands on the contact list of this site, where the flag is actually set.
    expect(screen.getByText(ct('contacts.col.locationPrimary'))).toBeInTheDocument()
  })

  it('no longer guesses a contact from the typed name — not even on a single exact match', () => {
    render(<LocationDetail location={location({ contactName: 'Joost de Boer' })} onSave={vi.fn()} {...baseProps}
      contacts={[contactFixture()]} />)

    // The typed value is still shown — it is real data and is never dropped…
    expect(screen.getByText('Joost de Boer')).toBeInTheDocument()
    // …but it is text, not a link to a record it was only ASSUMED to mean.
    expect(screen.queryByRole('button', { name: 'Joost de Boer' })).toBeNull()
  })

  it('keeps the free-text field editable, so no typed value is lost', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LocationDetail location={location({ contactName: 'Joost de Boer' })} onSave={onSave} {...baseProps} />)

    // The "Contact ter plaatse" card's own pencil — the third field group on this sub-tab.
    const pencils = screen.getAllByRole('button', { name: cm('edit') })
    await user.click(pencils[pencils.length - 1])
    const input = screen.getByDisplayValue('Joost de Boer')
    await user.clear(input)
    await user.type(input, 'Marieke Jansen')
    await user.click(screen.getByRole('button', { name: cm('save') }))

    expect(onSave).toHaveBeenCalledWith('loc-1', expect.objectContaining({ contactName: 'Marieke Jansen' }))
  })
})
