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
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  unwrap: (r: { data?: unknown }) => r?.data, unwrapList: () => ({ rows: [], total: 0 }),
}))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
vi.mock('@/lib/useContactFunctions', () => ({ useContactFunctions: () => ({ contactFunctions: [], allowFreeEntry: false }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

const ct = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'customers', ...opts })

const contact = (over: Partial<Contact> = {}): Contact => ({
  id: 'c1', helloflexLink: null, shiftmanagerLink: null,
  firstName: 'Eva', middleName: '', lastName: 'Bos', name: 'Eva Bos', role: 'HR Manager',
  email: 'eva@klant.test', phone: '', mobile: '0612345678', isPrimary: false,
  locationId: 'loc-1', locationName: '', departmentId: 'dep-1', departmentName: '',
  locations: [], departments: [], statusId: null, status: '', statusLabel: '', statusColor: '',
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
})
