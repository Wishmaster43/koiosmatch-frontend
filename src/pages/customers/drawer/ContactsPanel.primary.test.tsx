/** ContactsPanel · primary contact, archive quick-view, couple/add gate, load states (split from ContactsPanel.test.tsx; same mocks, fixtures and host). */
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
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
  // this file relies on the REAL module.
  getActiveTenantId: vi.fn(() => null),
}))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
vi.mock('@/lib/useContactFunctions', () => ({ useContactFunctions: () => ({ contactFunctions: [], allowFreeEntry: false }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
// RIGHTS-GATE-OPENERS-1: wrapped in vi.fn() so the create-permission test below
// can override hasPermission — defaults to true (every other test in this file
// assumes the happy path, unrelated to the couple/add gate).
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn(() => ({ hasPermission: () => true })) }))
import { useAuth } from '@/context/AuthContext'

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

// RIGHTS-GATE-OPENERS-1: the "couple" (icon-only) and "+ contactpersoon" openers
// both hide without customers.update — never a dead button (§3).
describe('ContactsPanel · couple/add gate (RIGHTS-GATE-OPENERS-1)', () => {
  it('hides both openers without customers.update', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => false } as unknown as ReturnType<typeof useAuth>)
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" contacts={[contact()]} />)
    expect(screen.queryByRole('button', { name: ct('locations.detail.coupleAction') })).toBeNull()
    expect(screen.queryByRole('button', { name: ct('contacts.add') })).toBeNull()
  })

  it('shows both openers with customers.update', () => {
    vi.mocked(useAuth).mockReturnValue({ hasPermission: () => true } as unknown as ReturnType<typeof useAuth>)
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" contacts={[contact()]} />)
    expect(screen.getByRole('button', { name: ct('locations.detail.coupleAction') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ct('contacts.add') })).toBeInTheDocument()
  })
})

/**
 * AUDIT-NAFIX-1 (§3 four UI states) — a failed GET must render an error banner
 * with a retry, never the empty-list state.
 */
describe('ContactsPanel · loading/error states (AUDIT-NAFIX-1)', () => {
  it('shows an error banner with retry instead of the empty state when the load failed', () => {
    const onRetry = vi.fn()
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[]} error onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(ct('contacts.empty'))).not.toBeInTheDocument()
  })

  it('calls the passed reload on retry click', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ContactsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" contacts={[]} error onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: cm('error.retry') }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
