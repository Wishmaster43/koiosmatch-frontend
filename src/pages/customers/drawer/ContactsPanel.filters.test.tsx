/** ContactsPanel · default filter, pager, last contact (split from ContactsPanel.test.tsx; same mocks, fixtures and host). */
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
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
  // this file relies on the REAL module (see the invalidateAllSettingsCache import above).
  getActiveTenantId: vi.fn(() => null),
}))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
vi.mock('@/lib/useContactFunctions', () => ({ useContactFunctions: () => ({ contactFunctions: [], allowFreeEntry: false }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: vi.fn(() => ({ hasPermission: () => true })) }))

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

  it('shows the no-contact chip only for a flagged row, with its title (ONIX S-014)', () => {
    render(<Host {...base} scope="customer" contacts={[
      contact({ lastContactAt: '2026-07-14T09:30:00+02:00', lastContactType: 'phone', noContactDue: true }),
      contact({ id: 'c2', firstName: 'Piet', lastName: 'Klaas', name: 'Piet Klaas', lastContactAt: null, lastContactType: null, noContactDue: false }),
    ]} />)
    const chips = screen.getAllByText(ct('contacts.noContactDue'))
    expect(chips).toHaveLength(1)
    expect(chips[0].closest('[title]')).toHaveAttribute('title', ct('contacts.noContactDueTitle'))
  })

  it('keeps the column on every scope — it is the same one surface', () => {
    render(<Host {...base} scope="location" scopeId="loc-1"
      contacts={[contact({ lastContactAt: '2026-07-14T09:30:00+02:00', lastContactType: 'phone' })]} />)
    expect(screen.getByText(ct('contacts.col.lastContact'))).toBeInTheDocument()
    expect(screen.getByText('14-07-2026')).toBeInTheDocument()
  })
})
