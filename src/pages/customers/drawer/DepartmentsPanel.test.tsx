/**
 * DepartmentsPanel is the ONE department surface. Two things must hold and are easy to break:
 *
 *  1. It NEVER navigates. Opening a department swaps this panel's own body, so the host (a
 *     location) stays mounted and keeps its place — mirrors ContactsPanel.test.tsx's own guard.
 *  2. DepartmentDetail draws its OWN breadcrumb (backLabel + close) — this panel must not
 *     stack a second one, or the double-breadcrumb trap the contact refactor fixed comes back.
 */
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import { invalidateAllSettingsCache } from '@/lib/settings/useAllSettings'
import DepartmentsPanel from './DepartmentsPanel'
import type { ComponentProps } from 'react'
import type { Contact, Department } from '@/types/customer'
import type { Id } from '@/types/common'
import { chipInk } from '@/lib/tint'

// The panel is CONTROLLED: the host owns "which department is open". This stand-in host
// mirrors LocationDetail — it also renders a marker that must survive the drill-in.
type PanelProps = Omit<ComponentProps<typeof DepartmentsPanel>, 'openId' | 'onOpenChange'>
function Host({ onOpen, ...props }: PanelProps & { onOpen?: (id: Id | null) => void }) {
  const [openId, setOpenId] = useState<Id | null>(null)
  return (
    <div>
      {openId == null && <div>HOST-CHROME</div>}
      <DepartmentsPanel {...props} openId={openId} onOpenChange={id => { setOpenId(id); onOpen?.(id) }} />
    </div>
  )
}

// Defensive mocks (same set ContactsPanel.test.tsx uses): DepartmentDetail's nested
// ContactsPanel/CustomFieldsTab could reach these if a test ever drills a level deeper.
// The chip colours come from a settings fetch; this file asserts synchronously and does
// not care about them, so the hook is stubbed rather than left to resolve mid-assertion.
vi.mock('@/lib/settings/useChipColors', () => ({
  useChipColors: () => ({ location: 'var(--color-secondary)', department: 'var(--color-violet)' }),
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
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

const department = (over: Partial<Department> = {}): Department => ({
  id: 'd1', helloflexLink: null, shiftmanagerLink: null,
  name: 'Zorg', description: '', locationId: 'loc-1', locationName: 'Vestiging Noord',
  contacts: [], costCenter: '', statusId: null, status: '', statusLabel: '', statusColor: '',
  customFields: {},
  ...over,
} as Department)

const locations = [{ id: 'loc-1', name: 'Vestiging Noord' }, { id: 'loc-2', name: 'Vestiging Zuid' }]
const contacts: Contact[] = []
const base = {
  locations, contacts, statuses: [],
  onAdd: vi.fn(), onUpdate: vi.fn(), onRemove: vi.fn(),
  onAddContact: vi.fn(), onUpdateContact: vi.fn(), onRemoveContact: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('DepartmentsPanel · the drill-in never leaves the host', () => {
  it('swaps its own body for the department detail and reports the change to the host', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord"
      departments={[department()]} onOpen={onOpen} />)

    await user.click(screen.getByText('Zorg'))
    // The department's own screen is on the panel, and the host was told which one.
    expect(screen.getByText(ct('departments.detail.subtabs.data'))).toBeInTheDocument()
    expect(onOpen).toHaveBeenLastCalledWith('d1')
  })

  it('returns to this location\'s own list — not the customer tab — via its crumb', async () => {
    const user = userEvent.setup()
    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" departments={[department()]} />)

    await user.click(screen.getByText('Zorg'))
    // The host stood back while the department was open…
    expect(screen.queryByText('HOST-CHROME')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Vestiging Noord' }))
    // …and is back, with its own state intact, on this location's own list.
    expect(screen.queryByText(ct('departments.detail.subtabs.data'))).toBeNull()
    expect(screen.getByText('HOST-CHROME')).toBeInTheDocument()
    expect(screen.getByText('Zorg')).toBeInTheDocument()
  })
})

describe('DepartmentsPanel · one breadcrumb, not two (double-breadcrumb trap)', () => {
  it('hands DepartmentDetail the FULL trail — every ancestor stays its own clickable hop', async () => {
    const user = userEvent.setup()
    const backToLocations = vi.fn()
    // Host, not a static openId=null: the panel is controlled, so a real state owner is
    // needed to observe the swap-to-detail this test asserts on.
    render(<Host {...base} scope="location" scopeId="loc-1" scopeName="Vestiging Noord"
      departments={[department()]} trail={[{ label: 'Locations', onClick: backToLocations }]} />)

    await user.click(screen.getByText('Zorg'))
    const nav = screen.getByRole('navigation')
    // Two separate hops, not one folded label: "Locations" returns to the locations list,
    // "Vestiging Noord" to this location's own department list.
    expect(within(nav).getByRole('button', { name: 'Locations' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Vestiging Noord' })).toBeInTheDocument()
    // The crumb for the level you are ON is not clickable.
    expect(within(nav).queryByRole('button', { name: 'Zorg' })).toBeNull()
  })

  it('renders exactly ONE navigation element while a detail is open', async () => {
    const user = userEvent.setup()
    render(<Host {...base} scope="customer" departments={[department()]} />)

    await user.click(screen.getByText('Zorg'))
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
  })
})

describe('DepartmentsPanel · one surface, scope-trimmed columns', () => {
  it('shows the Locatie column at customer level', () => {
    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" departments={[department()]} />)
    expect(screen.getByText(ct('departments.col.location'))).toBeInTheDocument()
  })

  it('drops the Locatie column inside a location — it would repeat on every row', () => {
    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" departments={[department()]} />)
    expect(screen.queryByText(ct('departments.col.location'))).toBeNull()
    // Everything else the customer tab shows is still here. Scoped to the
    // columnheader role: the toolbar's StatusFilterSelect trigger now ALSO
    // renders the literal word "Status" (HUISSTIJL-1 batch G), so an unscoped
    // getByText('Status') matches both and throws.
    expect(screen.getByRole('columnheader', { name: ct('departments.col.status') })).toBeInTheDocument()
    expect(screen.getByText(ct('departments.col.contacts'))).toBeInTheDocument()
  })

  it('narrows to the scope: a department of another location is not listed here', () => {
    const inScope = department({ id: 'd1', name: 'Zorg', locationId: 'loc-1' })
    const outOfScope = department({ id: 'd2', name: 'Facilitair', locationId: 'loc-2' })
    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="location" scopeId="loc-1" scopeName="Vestiging Noord"
      departments={[inScope, outOfScope]} />)
    expect(screen.getByText('Zorg')).toBeInTheDocument()
    expect(screen.queryByText('Facilitair')).toBeNull()
  })
})

describe('DepartmentsPanel · colour on/off flags per column (CHIPKLEUR-INSTELBAAR-1)', () => {
  beforeEach(() => invalidateAllSettingsCache())

  it('keeps colouring both columns when no flag is saved (today\'s behaviour)', async () => {
    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" departments={[department()]} />)

    await waitFor(() => {
      expect(screen.getByText('Vestiging Noord')).toHaveStyle({ color: chipInk('var(--color-secondary)') })
      // Scoped to the columnheader role: the toolbar's StatusFilterSelect trigger
      // now ALSO renders the literal word "Status" (HUISSTIJL-1 batch G), so an
      // unscoped getByText('Status') matches both and throws.
      expect(screen.getByRole('columnheader', { name: ct('departments.col.status') })).toBeInTheDocument()
    })
  })

  it('renders the Locatie column as plain text once its flag is turned off', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_department_table_color_location: 'false' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" departments={[department()]} />)

    await waitFor(() => {
      expect(screen.getByText('Vestiging Noord')).toHaveStyle({ color: 'var(--text)' })
    })
  })

  it('renders the status chip as plain text once its flag is turned off', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_department_table_color_status: 'false' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer"
      // eslint-disable-next-line no-restricted-syntax -- DATA: arbitrary lookup-value colour simulating a saved status, not a UI colour choice
      departments={[department({ statusLabel: 'Actief', statusColor: '#16A34A' })]} />)

    await waitFor(() => {
      expect(screen.getByText('Actief')).toHaveStyle({ color: 'var(--text)' })
    })
  })
})

// TENANT-DEFAULT-1 (Danny 02-08): the tenant-configured default status filter
// replaces the frontend's own "active only" guess for this tab.
describe('DepartmentsPanel · tenant-configured default status filter (TENANT-DEFAULT-1)', () => {
  beforeEach(() => invalidateAllSettingsCache())

  const statuses = [
    { id: 'status-active', value: 'active', label: 'Actief' },
    { id: 'status-inactive', value: 'inactive', label: 'Inactief' },
  ]
  const twoDepartments = [
    department({ id: 'd-active', name: 'Actieve afdeling', statusId: 'status-active', statusLabel: 'Actief' }),
    department({ id: 'd-inactive', name: 'Inactieve afdeling', statusId: 'status-inactive', statusLabel: 'Inactief' }),
  ]

  it('still guesses "active only" when no default is configured (today\'s behaviour)', async () => {
    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" departments={twoDepartments} statuses={statuses} />)
    await waitFor(() => expect(screen.getByText('Actieve afdeling')).toBeInTheDocument())
    expect(screen.queryByText('Inactieve afdeling')).toBeNull()
  })

  it('applies the configured default status when the tab opens', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_department_default_status_filter: 'status-inactive' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" departments={twoDepartments} statuses={statuses} />)
    await waitFor(() => expect(screen.getByText('Inactieve afdeling')).toBeInTheDocument())
    expect(screen.queryByText('Actieve afdeling')).toBeNull()
  })

  it('an explicit "all" default shows every row, ignoring the active-only guess', async () => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      url === '/settings'
        ? Promise.resolve({ data: { customer_department_default_status_filter: 'all' } })
        : Promise.resolve({ data: { data: [] } }))

    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" departments={twoDepartments} statuses={statuses} />)
    await waitFor(() => {
      expect(screen.getByText('Actieve afdeling')).toBeInTheDocument()
      expect(screen.getByText('Inactieve afdeling')).toBeInTheDocument()
    })
  })
})

describe('DepartmentsPanel · add trigger pre-selects the location it was opened from', () => {
  it('hides the location picker in the add modal when opened from a location', async () => {
    const user = userEvent.setup()
    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="location" scopeId="loc-1" scopeName="Vestiging Noord" departments={[]} />)

    await user.click(screen.getByRole('button', { name: ct('departments.add') }))
    // AddDepartmentModal hides its own location picker when `lockLocationId` is set —
    // it is implied by the scope, not user-chosen there (mirrors LocationDepartments).
    expect(screen.queryByText(ct('subModal.selectLocation'))).toBeNull()
  })

  it('shows the location picker in the add modal at customer level', async () => {
    const user = userEvent.setup()
    render(<DepartmentsPanel {...base} openId={null} onOpenChange={vi.fn()} scope="customer" departments={[]} />)

    await user.click(screen.getByRole('button', { name: ct('departments.add') }))
    // Scoped to the modal dialog: "Locatie" is ALSO the table's own column header text,
    // so an unscoped query would match both and fail as ambiguous.
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(ct('subModal.selectLocation'))).toBeInTheDocument()
  })
})

/**
 * DRILL-PAGER-1 adoption (recipe from the pager lane): the department pager steps
 * through EXACTLY the rows the search filter left visible — "next" from the first
 * visible department lands on the second visible one, never the filtered-out row,
 * and the ends disable. Without the DepartmentsPanel/DepartmentDetail wiring this
 * block fails wholesale: there is no pager to find.
 */
describe('DepartmentsPanel · pager steps through the filtered rows (DRILL-PAGER-1)', () => {
  const three = [
    department({ id: 'd-a', name: 'Ambulant' }),
    department({ id: 'd-b', name: 'Anesthesie' }),
    // Filtered OUT by the search below — proves the pager follows the visible set.
    department({ id: 'd-x', name: 'Wijkzorg' }),
  ]

  it('pages to the next VISIBLE department and disables at each end', async () => {
    render(<Host {...base} scope="customer" departments={three} />)
    // Narrow to the two "A…" departments, then open the first.
    fireEvent.change(screen.getByPlaceholderText(ct('departments.searchPlaceholder')), { target: { value: 'An' } })
    fireEvent.click(screen.getByText('Ambulant'))
    // Counter runs against the FILTERED total (2), not the wider list (3).
    const next = screen.getByTitle(cm('drillPager.nextAt', { index: 1, total: 2 }))
    expect(screen.getByTitle(cm('drillPager.prevAt', { index: 1, total: 2 }))).toBeDisabled()
    fireEvent.click(next)
    // Landed on the second visible one (name renders in breadcrumb AND title — both fine);
    // never on the filtered-out Wijkzorg.
    expect(screen.getAllByText('Anesthesie').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Wijkzorg')).not.toBeInTheDocument()
    expect(screen.getByTitle(cm('drillPager.nextAt', { index: 2, total: 2 }))).toBeDisabled()
  })
})

/**
 * ARCHIVE-SUBENTITY-1 — the "Gearchiveerd" quick-view is a SEPARATE fetch (never
 * merged into the live list), gated entirely on the toggle. Assert the REQUEST (§13).
 */
describe('DepartmentsPanel · Gearchiveerd quick-view (ARCHIVE-SUBENTITY-1)', () => {
  it('fires no archived-list request until the toggle is switched on', () => {
    render(<Host {...base} scope="customer" customerId="cust-1" departments={[department()]} />)
    expect(vi.mocked(api.get).mock.calls.some(([, cfg]) => (cfg as { params?: { include_archived?: number } } | undefined)?.params?.include_archived === 1)).toBe(false)
  })

  it('requests include_archived=1 for this customer\'s own departments once toggled on', async () => {
    const user = userEvent.setup()
    render(<Host {...base} scope="customer" customerId="cust-1" departments={[department()]} />)

    await user.click(screen.getByRole('button', { name: ct('departments.archivedView') }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/customers/cust-1/departments', expect.objectContaining({ params: { include_archived: 1 } })))
  })
})
