/**
 * ContactsPanel is the ONE contact surface. Two things must hold and are easy to break:
 *
 *  1. It NEVER navigates. Opening a contact swaps this panel's own body, so the host (a
 *     location, a department) stays mounted and keeps its place. The previous attempt
 *     switched the drawer's main tab, which unmounted the location — Danny 28-07: "als je
 *     dan terug klikt ben je uit de vestiging of afdeling???".
 *  2. The three scopes really are one surface: same columns, minus only the column that
 *     would repeat the scope itself.
 */
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import { invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import ContactsPanel from './ContactsPanel'
import type { ComponentProps } from 'react'
import type { Contact, Department } from '@/types/customer'
import type { Id } from '@/types/common'

// The panel is CONTROLLED: the host owns "which contact is open". This stand-in host
// mirrors LocationDetail — it also renders a marker that must survive the drill-in,
// which is the whole point (the old fix unmounted the host and lost it).
type PanelProps = Omit<ComponentProps<typeof ContactsPanel>, 'openId' | 'onOpenChange'>
function Host({ onOpen, ...props }: PanelProps & { onOpen?: (id: Id | null) => void }) {
  const [openId, setOpenId] = useState<Id | null>(null)
  return (
    <div>
      {openId == null && <div>HOST-CHROME</div>}
      <ContactsPanel {...props} openId={openId} onOpenChange={id => { setOpenId(id); onOpen?.(id) }} />
    </div>
  )
}

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  unwrap: (r: { data?: unknown }) => r?.data, unwrapList: () => ({ rows: [], total: 0 }),
  // The real (unmocked) useAllSettings module reads this to tenant-scope its cache —
  // this file relies on the REAL module (see invalidateAllSettingsCache import above).
  getActiveTenantId: vi.fn(() => null),
}))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
vi.mock('@/lib/useContactFunctions', () => ({ useContactFunctions: () => ({ contactFunctions: [], allowFreeEntry: false }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })
const cm = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'common', ...opts })

const contact = (over: Partial<Contact> = {}): Contact => ({
  id: 'c1', helloflexLink: null, shiftmanagerLink: null,
  firstName: 'Eva', middleName: '', lastName: 'Bos', name: 'Eva Bos', role: 'HR Manager',
  email: 'eva@klant.test', phone: '', mobile: '0612345678', isPrimary: false,
  locationId: 'loc-1', locationName: '', departmentId: 'dep-1', departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '',
  customerId: 'cust-1', gender: '',
  lastContactAt: null, lastContactType: null, customFields: {},
  ...over,
} as Contact)

const locations = [{ id: 'loc-1', name: 'Vestiging Noord' }, { id: 'loc-2', name: 'Vestiging Zuid' }]
const departments = [{ id: 'dep-1', name: 'Zorg', locationId: 'loc-1' } as Department]
const base = {
  locations, departments, statuses: [],
  onAdd: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('ContactsPanel · the drill-in never leaves the host', () => {
  it('swaps its own body for the contact detail and reports the change to the host', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord"
      contacts={[contact()]} onOpen={onOpen} />)

    await user.click(screen.getByText('Eva Bos'))
    // The contact's own screen is on the panel, and the host was told which one.
    expect(screen.getByText(ct('contacts.detail.infoTitle'))).toBeInTheDocument()
    expect(onOpen).toHaveBeenLastCalledWith('c1')
  })

  it('shows the full trail — the host\'s crumbs, this list, then the contact', async () => {
    const user = userEvent.setup()
    const backToLocations = vi.fn()
    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord"
      contacts={[contact()]} trail={[{ label: 'Locaties', onClick: backToLocations }]} />)

    await user.click(screen.getByText('Eva Bos'))
    const nav = screen.getByRole('navigation')
    expect(within(nav).getByRole('button', { name: 'Locaties' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Vestiging Noord' })).toBeInTheDocument()
    // The crumb for the level you are ON is not clickable.
    expect(within(nav).queryByRole('button', { name: 'Eva Bos' })).toBeNull()
  })

  it('returns to this location\'s own list — not the customer tab — via its crumb', async () => {
    const user = userEvent.setup()
    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" contacts={[contact()]} />)

    await user.click(screen.getByText('Eva Bos'))
    // The host stood back while the contact was open…
    expect(screen.queryByText('HOST-CHROME')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Vestiging Noord' }))
    // …and is back, with its own state intact, on this location's own list.
    expect(screen.queryByText(ct('contacts.detail.infoTitle'))).toBeNull()
    expect(screen.getByText('HOST-CHROME')).toBeInTheDocument()
    expect(screen.getByText('Eva Bos')).toBeInTheDocument()
  })
})

describe('ContactsPanel · one surface, scope-trimmed columns', () => {
  it('shows Locatie and Afdeling at customer level', () => {
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[contact()]} />)
    expect(screen.getByText(ct('contacts.col.location'))).toBeInTheDocument()
    expect(screen.getByText(ct('contacts.col.department'))).toBeInTheDocument()
  })

  it('drops the Locatie column inside a location — it would repeat on every row', () => {
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" contacts={[contact()]} />)
    expect(screen.queryByText(ct('contacts.col.location'))).toBeNull()
    expect(screen.getByText(ct('contacts.col.department'))).toBeInTheDocument()
    // Everything else the customer tab shows is still here.
    expect(screen.getByText(ct('contacts.col.status'))).toBeInTheDocument()
    expect(screen.getByText(ct('contacts.col.mobile'))).toBeInTheDocument()
    expect(screen.getByText(ct('contacts.col.lastContact'))).toBeInTheDocument()
  })

  it('drops both Locatie and Afdeling inside a department', () => {
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="department" scopeId="dep-1" scopeName="Zorg" contacts={[contact()]} />)
    expect(screen.queryByText(ct('contacts.col.location'))).toBeNull()
    expect(screen.queryByText(ct('contacts.col.department'))).toBeNull()
  })

  it('narrows to the scope: a contact of another location is not listed here', () => {
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="location" scopeId="loc-2" scopeName="Vestiging Zuid" contacts={[contact()]} />)
    expect(screen.queryByText('Eva Bos')).toBeNull()
  })
})

describe('ContactsPanel · scoped actions are the real backend paths', () => {
  it('uncoupling from a location PATCHes locationId: null and nothing else', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} onUpdate={onUpdate} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" contacts={[contact()]} />)
    await user.click(screen.getByRole('button', { name: ct('locations.detail.uncoupleAction') }))
    expect(onUpdate).toHaveBeenCalledWith('c1', { locationId: null })
  })

  it('uncoupling from a department PATCHes departmentId: null, leaving the location alone', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} onUpdate={onUpdate} scope="department" scopeId="dep-1" scopeName="Zorg" contacts={[contact()]} />)
    await user.click(screen.getByRole('button', { name: ct('departments.detail.uncoupleAction') }))
    expect(onUpdate).toHaveBeenCalledWith('c1', { departmentId: null })
  })

  it('offers no coupling at customer level — a contact is already "here"', () => {
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[contact()]} />)
    expect(screen.queryByRole('button', { name: ct('locations.detail.coupleAction') })).toBeNull()
  })
})

describe('ContactsPanel · chip colours read the tenant setting (CHIPKLEUR-INSTELBAAR-1)', () => {
  // useAllSettings caches its response at MODULE scope (one fetch per session), so an
  // earlier test in this file leaves a stale cache behind. Reset it before each case
  // here so every test's /settings mock is the one actually read — mirrors the reset
  // useContactFunctions.test.ts does for its own module-scope cache.
  beforeEach(() => invalidateAllSettingsCache())

  it('keeps today\'s colours when no chip-color setting is saved', async () => {
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[contact()]} />)

    // Documented backend fallbacks (SettingController.php, CHIPKLEUR-INSTELBAAR-1) —
    // absent must render exactly like before this setting existed.
    await waitFor(() => {
      expect(screen.getByText('Vestiging Noord')).toHaveStyle({ color: 'var(--color-secondary)' })
      expect(screen.getByText('Zorg')).toHaveStyle({ color: 'var(--color-violet)' })
    })
  })

  it('uses the tenant-saved colours once /settings returns them', async () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA: arbitrary tenant-picked hex values simulating a saved API setting, not a UI colour choice
    const savedLocationColor = '#ff0000'
    // eslint-disable-next-line no-restricted-syntax -- DATA: arbitrary tenant-picked hex values simulating a saved API setting, not a UI colour choice
    const savedDepartmentColor = '#00cc66'
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_location_chip_color: savedLocationColor, customer_department_chip_color: savedDepartmentColor } })
        : Promise.resolve({ data: { data: [] } }))

    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[contact()]} />)

    await waitFor(() => {
      expect(screen.getByText('Vestiging Noord')).toHaveStyle({ color: savedLocationColor })
      expect(screen.getByText('Zorg')).toHaveStyle({ color: savedDepartmentColor })
    })
  })
})

describe('ContactsPanel · colour on/off flags per column (CHIPKLEUR-INSTELBAAR-1)', () => {
  beforeEach(() => invalidateAllSettingsCache())

  it('keeps colouring both columns when no flag is saved (today\'s behaviour)', async () => {
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[contact()]} />)

    await waitFor(() => {
      expect(screen.getByText('Vestiging Noord')).toHaveStyle({ color: 'var(--color-secondary)' })
      expect(screen.getByText('Zorg')).toHaveStyle({ color: 'var(--color-violet)' })
    })
  })

  it('renders the Locatie column as plain text once its flag is turned off', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_contact_table_color_location: 'false' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[contact()]} />)

    await waitFor(() => {
      expect(screen.getByText('Vestiging Noord')).toHaveStyle({ color: 'var(--text)' })
      // The Afdeling column keeps its colour — the two flags are independent.
      expect(screen.getByText('Zorg')).toHaveStyle({ color: 'var(--color-violet)' })
    })
  })

  it('renders the Afdeling column as plain text once its flag is turned off', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_contact_table_color_department: 'false' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[contact()]} />)

    await waitFor(() => {
      expect(screen.getByText('Zorg')).toHaveStyle({ color: 'var(--text)' })
      expect(screen.getByText('Vestiging Noord')).toHaveStyle({ color: 'var(--color-secondary)' })
    })
  })

  // The status flag was left out of the original contract because this list had no
  // status column. It has one now, and no backend change was needed: SettingController
  // validates the whole `*_table_color_*` family by pattern, not against a fixed list.
  it('renders the status as a coloured chip by default, and as plain text once its flag is off', async () => {
    const withStatus = contact({ statusId: 's1', statusLabel: 'Actief', statusColor: '#10B981' })

    const { unmount } = render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[withStatus]} />)
    await waitFor(() => expect(screen.getByText('Actief')).toHaveStyle({ color: '#10B981' }))
    unmount()

    invalidateAllSettingsCache()
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_contact_table_color_status: 'false' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[withStatus]} />)
    await waitFor(() => {
      const cell = screen.getByText('Actief')
      expect(cell).not.toHaveStyle({ color: '#10B981' })
      // The other two columns are unaffected — the three flags are independent.
      expect(screen.getByText('Vestiging Noord')).toHaveStyle({ color: 'var(--color-secondary)' })
    })
  })
})

// TENANT-DEFAULT-1 (Danny 02-08): the tenant-configured default status filter
// replaces the frontend's own "active only" guess for this tab.
describe('ContactsPanel · tenant-configured default status filter (TENANT-DEFAULT-1)', () => {
  beforeEach(() => invalidateAllSettingsCache())

  const statuses = [
    { id: 'status-active', value: 'active', label: 'Actief' },
    { id: 'status-inactive', value: 'inactive', label: 'Inactief' },
  ]
  const twoContacts = [
    contact({ id: 'c-active', name: 'Actieve contactpersoon', statusId: 'status-active', statusLabel: 'Actief' }),
    contact({ id: 'c-inactive', name: 'Inactieve contactpersoon', statusId: 'status-inactive', statusLabel: 'Inactief' }),
  ]

  it('still guesses "active only" when no default is configured (today\'s behaviour)', async () => {
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={twoContacts} statuses={statuses} />)
    await waitFor(() => expect(screen.getByText('Actieve contactpersoon')).toBeInTheDocument())
    expect(screen.queryByText('Inactieve contactpersoon')).toBeNull()
  })

  it('applies the configured default status when the tab opens', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_contact_default_status_filter: 'status-inactive' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={twoContacts} statuses={statuses} />)
    await waitFor(() => expect(screen.getByText('Inactieve contactpersoon')).toBeInTheDocument())
    expect(screen.queryByText('Actieve contactpersoon')).toBeNull()
  })

  it('an explicit "all" default shows every row, ignoring the active-only guess', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_contact_default_status_filter: 'all' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={twoContacts} statuses={statuses} />)
    await waitFor(() => {
      expect(screen.getByText('Actieve contactpersoon')).toBeInTheDocument()
      expect(screen.getByText('Inactieve contactpersoon')).toBeInTheDocument()
    })
  })
})

/**
 * DRILL-PAGER-1 (Danny 02-08: "moeten er pijltjes komen zodat je vanuit één
 * contactpersoon naar de volgende kan en terug"). The pager must step through
 * EXACTLY the rows the user was looking at — with the status filter narrowing the
 * list to two of three contacts, "next" must never land on the filtered-out third
 * one, and the counter must report against the FILTERED total (2), not the wider
 * unscoped one (3). Without DrillPager's adoption this whole block fails: there is
 * no pager to find at all.
 */
describe('ContactsPanel · pager steps through the caller\'s OWN filtered rows (DRILL-PAGER-1)', () => {
  // A prior describe block's LAST test leaves a custom /settings mockImplementation
  // behind (mockClear() clears call history, never a mocked implementation) — reset
  // it explicitly so this block's "no configured default" assumption holds regardless
  // of file execution order.
  beforeEach(() => {
    invalidateAllSettingsCache()
    vi.mocked(api.get).mockImplementation(() => Promise.resolve({ data: { data: [] } }))
  })

  const statuses = [
    { id: 'status-active', value: 'active', label: 'Actief' },
    { id: 'status-inactive', value: 'inactive', label: 'Inactief' },
  ]
  const threeContacts = [
    contact({ id: 'c-a', name: 'Anna Actief', statusId: 'status-active', statusLabel: 'Actief' }),
    contact({ id: 'c-b', name: 'Bram Actief', statusId: 'status-active', statusLabel: 'Actief' }),
    // Filtered OUT by the default "active only" guess — proves the pager counts ONLY
    // what the status filter actually shows, never the wider unscoped list.
    contact({ id: 'c-c', name: 'Cor Inactief', statusId: 'status-inactive', statusLabel: 'Inactief' }),
  ]

  it('pages to the next VISIBLE contact, never the one the filter hid, and disables at each end', async () => {
    const user = userEvent.setup()
    render(<Host {...base} scope="customer" contacts={threeContacts} statuses={statuses} />)

    await waitFor(() => expect(screen.getByText('Anna Actief')).toBeInTheDocument())
    // The filter really did narrow the list — the scoping this pager must respect.
    expect(screen.queryByText('Cor Inactief')).toBeNull()

    await user.click(screen.getByText('Anna Actief'))
    // First of TWO visible contacts (never three) — prev is honestly disabled here.
    expect(screen.getByTitle(cm('drillPager.nextAt', { index: 1, total: 2 }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: cm('drillPager.prev') })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: cm('drillPager.next') }))
    // Landed on the SECOND visible contact, never the filtered-out third. The name
    // legitimately repeats (breadcrumb "current" + title), so scope to the breadcrumb,
    // the one spot that can only mean "this is the record now open".
    expect(within(screen.getByRole('navigation')).getByText('Bram Actief')).toBeInTheDocument()
    expect(screen.getByTitle(cm('drillPager.nextAt', { index: 2, total: 2 }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: cm('drillPager.next') })).toBeDisabled()
  })
})

/**
 * CONTACT-LAATSTE-CONTACT-1 — Danny asked for "laatste contact datum en type" in the
 * contacts table weeks ago. The columns always existed; CustomerContactResource simply
 * never sent them, so the column rendered a dash for every row. Now that it does, the
 * date must render DD-MM-YYYY through lib/formatters' locale-aware helper — never a
 * hand-rolled slice of the ISO string, and never the raw ISO value.
 */
describe('ContactsPanel · last contact column', () => {
  const lastContactCell = (name: string) => {
    const row = screen.getByText(name).closest('tr')!
    return row.querySelectorAll('td')
  }

  it('renders the date DD-MM-YYYY, not the raw ISO timestamp', () => {
    render(<Host {...base} scope="customer"
      contacts={[contact({ lastContactAt: '2026-07-14T09:30:00+02:00', lastContactType: 'phone' })]} />)
    expect(screen.getByText('14-07-2026')).toBeInTheDocument()
    expect(screen.queryByText(/2026-07-14T/)).not.toBeInTheDocument()
  })

  it('falls back to a dash when the contact was never contacted', () => {
    render(<Host {...base} scope="customer" contacts={[contact({ lastContactAt: null, lastContactType: null })]} />)
    const cells = [...lastContactCell('Eva Bos')].map(c => c.textContent)
    expect(cells).toContain('—')
  })

  it('keeps the column on every scope — it is the same one surface', () => {
    render(<Host {...base} scope="location" scopeId="loc-1"
      contacts={[contact({ lastContactAt: '2026-07-14T09:30:00+02:00', lastContactType: 'phone' })]} />)
    expect(screen.getByText(ct('contacts.col.lastContact'))).toBeInTheDocument()
    expect(screen.getByText('14-07-2026')).toBeInTheDocument()
  })
})

/**
 * CONTACT-LOCATION-PRIMARY-1 — the primary contact PER LOCATION, which Danny asked for
 * weeks ago and the backend now carries on customer_contact_customer_location.is_primary.
 *
 * Two failure modes these guard, both of which have bitten this codebase before:
 *  1. A control that fires the wrong request (or none). The route was measured off
 *     routes/api/tenant/customers.php — PUT …/contacts/{id}/locations/{locationId}/primary
 *     — so the REQUEST is asserted, not that a handler ran.
 *  2. Blurring the two primaries. The customer's ONE main contact and this site's own are
 *     different columns with different meanings; where both can show, each must say which.
 */
// A contact carrying the per-location primary flags exactly as useCustomerContacts
// attaches them (see primaryLocationIdsOf — they ride along on the row).
const primaryAt = (locationIds: string[], over: Partial<Contact> = {}): Contact =>
  ({ ...contact(over), primaryLocationIds: locationIds } as Contact)

const primaryStar = () => screen.queryByRole('button', { name: ct('locations.detail.setPrimaryContact') })

describe('ContactsPanel · primary contact per location', () => {
  it('PUTs the measured per-location route when the star is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(api.put).mockResolvedValue({ data: { id: 'c1', locations: [{ id: 'loc-1', name: 'Vestiging Noord', is_primary: true }] } })

    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" contacts={[contact()]} />)
    await user.click(primaryStar()!)

    expect(api.put).toHaveBeenCalledTimes(1)
    expect(api.put).toHaveBeenCalledWith('/customers/cust-1/contacts/c1/locations/loc-1/primary')
    // The customer-level primary is a different column on a different route.
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('marks the location primary and offers no un-set — the backend has no route for it', () => {
    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord"
      contacts={[primaryAt(['loc-1'])]} />)

    expect(screen.getByText(ct('contacts.primaryLocationChip'))).toBeInTheDocument()
    // The row that IS primary shows a state, never a toggle with nothing behind it.
    expect(primaryStar()).toBeNull()
    expect(screen.getByLabelText(ct('locations.detail.isPrimaryContact'))).toBeInTheDocument()
  })

  it('says WHICH primary each chip means when a contact is both', () => {
    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord"
      contacts={[primaryAt(['loc-1'], { isPrimary: true })]} />)

    // Both chips are on the same row, and neither reads as the other.
    expect(screen.getByText(ct('contacts.primaryCustomerChip'))).toBeInTheDocument()
    expect(screen.getByText(ct('contacts.primaryLocationChip'))).toBeInTheDocument()
    expect(screen.queryByText(ct('contacts.primaryChip'))).toBeNull()
  })

  it('flags only the site you are IN — primary elsewhere is not primary here', () => {
    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord"
      contacts={[primaryAt(['loc-2'])]} />)

    expect(screen.queryByText(ct('contacts.primaryLocationChip'))).toBeNull()
    // …and it can still be promoted here.
    expect(primaryStar()).toBeInTheDocument()
  })

  it('does not exist at customer level — there is no per-site flag to write there', () => {
    render(<Host {...base} scope="customer" contacts={[primaryAt(['loc-1'], { isPrimary: true })]} />)

    expect(screen.queryByText(ct('contacts.col.locationPrimary'))).toBeNull()
    expect(primaryStar()).toBeNull()
    // The customer axis keeps its own unqualified chip where it is the only one shown.
    expect(screen.getByText(ct('contacts.primaryChip'))).toBeInTheDocument()
  })

  // DEPT-PRIMARY-1 (05-08): department scope grew its OWN primary flag (pivot +
  // PUT …/departments/{id}/primary) — the star now exists here too, reading the
  // department axis, with department-specific copy.
  it('exists inside a department with its own axis — promotable via the department star', () => {
    render(<Host {...base} scope="department" scopeId="dep-1" scopeName="Zorg" contacts={[primaryAt(['loc-1'])]} />)

    expect(screen.queryByRole('button', { name: ct('departments.detail.setPrimaryContact') })).toBeInTheDocument()
    // The location-scope star label does NOT leak into department scope.
    expect(primaryStar()).toBeNull()
  })

  /**
   * The endpoint is a documented no-op while the pivot column is missing on a tenant
   * database (CustomerContactLocation::supportsPrimary): 200, flag unchanged. Silence
   * there would be a button that reports a write which never happened.
   */
  it('says so when a 200 came back without the flag actually moving', async () => {
    const user = userEvent.setup()
    vi.mocked(api.put).mockResolvedValue({ data: { id: 'c1', locations: [{ id: 'loc-1', name: 'Vestiging Noord', is_primary: false }] } })

    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" contacts={[contact()]} />)
    await user.click(primaryStar()!)

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(ct('locations.detail.setPrimaryContactUnavailable')))
    expect(notifySuccess).not.toHaveBeenCalled()
  })

  it('surfaces a rejected request instead of failing silently', async () => {
    const user = userEvent.setup()
    vi.mocked(api.put).mockRejectedValue({ response: { status: 403 } })

    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" contacts={[contact()]} />)
    await user.click(primaryStar()!)

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith(ct('locations.detail.setPrimaryContactFailed')))
  })

  it('confirms the promotion once the server says it landed', async () => {
    const user = userEvent.setup()
    vi.mocked(api.put).mockResolvedValue({ data: { id: 'c1', locations: [{ id: 'loc-1', name: 'Vestiging Noord', is_primary: true }] } })

    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" contacts={[contact()]} />)
    await user.click(primaryStar()!)

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith(ct('locations.detail.setPrimaryContactDone', { name: 'Eva Bos' })))
  })
})

/**
 * ARCHIVE-SUBENTITY-1 — the "Gearchiveerd" quick-view is a SEPARATE fetch (never
 * merged into the live list), gated entirely on the toggle. Assert the REQUEST
 * (§13). No explicit `customerId` prop here on purpose: it proves the fallback
 * derivation off a live contact's own `customerId` (contact() already carries
 * 'cust-1') — the path today's top-level ContactsTab actually exercises.
 */
describe('ContactsPanel · Gearchiveerd quick-view (ARCHIVE-SUBENTITY-1)', () => {
  it('fires no archived-list request until the toggle is switched on', () => {
    render(<Host {...base} scope="customer" contacts={[contact()]} />)
    expect(vi.mocked(api.get).mock.calls.some(([, cfg]) => (cfg as { params?: { include_archived?: number } } | undefined)?.params?.include_archived === 1)).toBe(false)
  })

  it('requests include_archived=1 for this customer\'s own contacts once toggled on', async () => {
    const user = userEvent.setup()
    render(<Host {...base} scope="customer" contacts={[contact()]} />)

    await user.click(screen.getByRole('button', { name: ct('contacts.archivedView') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/cust-1/contacts', expect.objectContaining({ params: { include_archived: 1 } })))
  })
})
