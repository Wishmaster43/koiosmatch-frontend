/** CustomerDrawer · delete, merge and Matches tab (split from CustomerDrawer.test.tsx; mocks and helpers are duplicated per file because hoisted vi.mock blocks cannot be shared). */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import api from '@/lib/api'
import CustomerDrawer from './CustomerDrawer'
import type { Customer } from '@/types/customer'
import { customerPhasesValue } from './CustomerDrawer.testKit'

// DELETE-ICON-1: api.delete is the trash icon's real persistence path (§3 — no
// fake affordance); api.get is only here so any accidental stray call resolves.
// TRASH-OVERAL-2: post + unwrap serve the shared TrashLifecycleSection
// (deletion-preview GET, mark/unmark POSTs) rendered via the `trash` prop.
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({})),
    post: vi.fn(() => Promise.resolve({ data: { data: { lifecycle: 'pending_erase' } } })),
  },
  unwrap: (res: { data?: unknown }) => {
    const body = res?.data
    return body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
  },
}))
// The tenant grace window read by useDeletionLifecycle's session cache.
vi.mock('@/pages/settings/lib/settingsApi', () => ({
  loadSettings: () => Promise.resolve({ deletion_grace_days: '30' }),
}))
// MatchesTab fires its own GET (proven in its own test file) — stubbed here so
// this file stays about the drawer shell (header icons + tab wiring), not the
// tab's internals.
vi.mock('./drawer/MatchesTab', () => ({ default: () => <div>matches stub</div> }))
// Tenant-renamed phases — the badge/convert button can only read these from the lookup (fixtures live in the kit).
const mockUseCustomerPhases = vi.fn(() => customerPhasesValue())
vi.mock('@/lib/useCustomerPhases', () => ({
  useCustomerPhases: () => mockUseCustomerPhases(),
}))
// CUSTOMER-DEFAULT-STATUS-1: the tenant settings blob doConvertPhase reads for
// its default-status-on-convert key. Defaults to {} (no setting configured) so
// existing tests below are unaffected; individual tests override per case.
const mockUseAllSettings = vi.fn((): Record<string, unknown> => ({}))
// KLANT-BLACKLIST-PROMPT-1: useCustomerDrawerActions now also reads getBoolSetting
// from this module — re-export the real (pure) helper alongside the mocked hook.
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/useAllSettings')>('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => mockUseAllSettings() }
})
// Session + tenant plumbing the shell reads; no module/permission is needed by
// default. Wrapped in vi.fn() (mirrors mockUseCustomerPhases below) so the
// DELETE-ICON-1 tests can override hasPermission per case. Explicit return type
// (mirrors the `: boolean` note in CustomerDrawer.testKit.ts) — without it TS
// narrows `hasPermission` to the literal `() => false` from this first call site.
interface MockAuthValue { user: { name: string }; hasModule: () => boolean; hasPermission: (p: string) => boolean }
const mockUseAuth = vi.fn((): MockAuthValue => ({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: () => false }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('@/lib/useCustomFields', () => ({ useCustomFields: () => ({ fields: [] }) }))
// Sub-entity CRUD hooks fire their own GETs — stub them to empty, static results.
vi.mock('./hooks/useCustomerLocations', () => ({ useCustomerLocations: () => ({ locations: [] }), LOCATIONS_CHANGED_EVENT: 'km:locations-changed' }))
vi.mock('./hooks/useCustomerDepartments', () => ({ useCustomerDepartments: () => ({ departments: [] }), DEPARTMENTS_CHANGED_EVENT: 'km:departments-changed' }))
vi.mock('./hooks/useCustomerContacts', () => ({ useCustomerContacts: () => ({ contacts: [] }), CONTACTS_CHANGED_EVENT: 'km:contacts-changed' }))
// Only the ACTIVE tab renders (EntityDrawer) — stub it so this stays a header test.
vi.mock('./drawer/OverviewTab', () => ({ default: () => <div>overview stub</div> }))

const ct = (key: string) => i18n.t(key, { ns: 'customers' })

// 'vaste_klant' (NOT the entry phase) — the entry-phase Status-hiding rule
// (Danny 02-08) is covered by its own describe block in CustomerDrawer.test.tsx; this fixture keeps
// testing the "normal" case where the Status picker shows.
const customer = { id: 1, name: 'Zorgpartners', initials: 'ZP', phase: 'vaste_klant', status: 'active',
  tags: [], notes: [], created: '', referenceNumber: 'D-1', city: 'Utrecht', industry: 'Zorg' } as unknown as Customer

const statuses = [{ value: 'active', label: 'Actief' }]

describe('CustomerDrawer · delete icon (DELETE-ICON-1)', () => {
  const grantDelete = () => mockUseAuth.mockReturnValue({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: (p: string) => p === 'customers.delete' })

  it('renders NO delete icon without the customers.delete permission', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: () => false })
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByTitle(ct('drawer.delete'))).toBeNull()
  })

  it('renders the delete icon in the title row once customers.delete is granted', () => {
    grantDelete()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.getByTitle(ct('drawer.delete'))).toBeInTheDocument()
  })

  it('hides the delete icon once the customer is already archived', () => {
    grantDelete()
    render(<CustomerDrawer customer={{ ...customer, archived: true } as Customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByTitle(ct('drawer.delete'))).toBeNull()
  })

  it('does NOT call DELETE until the confirm dialog is accepted — cancel leaves it untouched', async () => {
    grantDelete()
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)

    await user.click(screen.getByTitle(ct('drawer.delete')))
    expect(api.delete).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: i18n.t('cancel', { ns: 'common' }) }))
    expect(api.delete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls DELETE /customers/{id} after confirming, flags it archived and closes the drawer', async () => {
    grantDelete()
    const onClose = vi.fn()
    const onUpdate = vi.fn()
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={onClose} onUpdate={onUpdate} statuses={statuses} />)

    await user.click(screen.getByTitle(ct('drawer.delete')))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/customers/1'))
    // 'archived' isn't in useCustomerRecord's FIELD_MAP — this is a pure local
    // flag, never a second PATCH riding on top of the DELETE that already ran.
    expect(onUpdate).toHaveBeenCalledWith(1, { archived: true })
    expect(onClose).toHaveBeenCalled()
  })

  it('maps a 409 conflict to an i18n message, never the raw server text, and keeps the drawer open', async () => {
    grantDelete()
    vi.mocked(api.delete).mockRejectedValueOnce({ response: { status: 409, data: { message: 'SQLSTATE[23000]: raw server text' } } })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={onClose} statuses={statuses} />)

    await user.click(screen.getByTitle(ct('drawer.delete')))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: i18n.t('confirm', { ns: 'common' }) }))

    await waitFor(() => expect(api.delete).toHaveBeenCalled())
    expect(screen.queryByText(/SQLSTATE/)).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })
})

// KLANT-SAMENVOEGEN-1: the merge icon gates on customers.update (the route's own
// permission — CustomerController::merge), same slot/style convention as the trash
// icon above but a DIFFERENT permission, so it is tested on its own rather than folded
// into the delete-icon block. Clicking is not exercised here (that renders
// MergeCustomerModal, which needs a QueryClientProvider — covered by its own test file).
describe('CustomerDrawer · merge icon (KLANT-SAMENVOEGEN-1)', () => {
  const grantMerge = () => mockUseAuth.mockReturnValue({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: (p: string) => p === 'customers.update' })

  it('renders NO merge icon without the customers.update permission', () => {
    mockUseAuth.mockReturnValue({ user: { name: 'Test User' }, hasModule: () => false, hasPermission: () => false })
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByTitle(ct('merge.title'))).toBeNull()
  })

  it('renders the merge icon in the title row once customers.update is granted', () => {
    grantMerge()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.getByTitle(ct('merge.title'))).toBeInTheDocument()
  })

  it('hides the merge icon once the customer is already archived', () => {
    grantMerge()
    render(<CustomerDrawer customer={{ ...customer, archived: true } as Customer} onClose={() => {}} statuses={statuses} />)
    expect(screen.queryByTitle(ct('merge.title'))).toBeNull()
  })
})

describe('CustomerDrawer · Matches tab (MATCHES-TAB-1)', () => {
  it('renders a Matches tab, wired to the customer-scoped MatchesTab component', async () => {
    const user = userEvent.setup()
    render(<CustomerDrawer customer={customer} onClose={() => {}} statuses={statuses} />)

    await user.click(screen.getByRole('tab', { name: ct('drawer.tabs.matches') }))
    expect(screen.getByText('matches stub')).toBeInTheDocument()
  })
})
